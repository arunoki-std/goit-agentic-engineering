# Spec: Run Cost Badge

**Feature:** показуємо вартість (USD) і токени кожного запуску агента у трьох місцях UI.  
**Данні:** `usage.prompt_tokens` / `completion_tokens` вже є у відповідях OpenRouter/OpenAI; вартість = токени × прайс (функція `estimateCost()` вже існує в `server/src/adapters/llm/pricing.ts`). На рівні БД поле `cost_usd` було видалено з `agent_runs` міграцією `0009` — потрібно повернути.

---

## Три екрани

### Екран 1 — Список PR (`/repos/:id/pulls`)
Нова колонка **COST** крайня права після "Updated".  
Значення: загальна вартість усіх запусків агентів для цього PR (сума `cost_usd` по `agent_runs.pr_id`).  
Формат: `$0.0124` (4 знаки після коми); якщо даних нема — `—`.

### Екран 2 — Таймлайн запусків (`Agent runs` tab на сторінці PR)
У рядку кожного завершеного (`status=done`) запуску — праворуч біля часу додати рядок:  
`9,119 tok · $0.0013`  
Якщо `cost_usd` null — показувати лише токени: `9,119 tok`.  
Якщо запуск не завершений (running/failed/cancelled) — не показувати.

### Екран 3 — Сайдбар Agent Run (RunTraceDrawer → TraceBody Stats)
Нова плитка **COST** між TOKENS і FINDINGS:

```
┌─────────┐  ┌─────────────┐  ┌──────┐  ┌──────────┐
│DURATION │  │  TOKENS     │  │ COST │  │ FINDINGS │
│  8.2s   │  │ 15k→1.2k   │  │$0.06 │  │    3     │
└─────────┘  └─────────────┘  └──────┘  └──────────┘
```

Якщо `cost_usd` null — `—`.

---

## Правила відображення

| Ситуація | Відображення |
|----------|-------------|
| `cost_usd` присутній | `$0.0124` |
| `cost_usd === null` (модель невідома у pricing.ts) | `—` (не `$0.00`) |
| Run ще виконується / failed / cancelled | не показувати вартість у таймлайні |
| PR без жодного run | `—` у списку PR |

---

## Нульові нові виклики моделі

Всі дані беруться з `usage` у вже наявній відповіді LLM. Нових HTTP-запитів не потрібно.

## Чому міграція не потрібна

`cost_usd` було **навмисно видалено** з `agent_runs` міграцією `0009` — тому що воно є похідним полем:

```
cost_usd = estimateCost(model, tokens_in, tokens_out)
```

Всі три вхідних поля вже зберігаються в `agent_runs`. `estimateCost()` — чиста функція (`pricing.ts`). Вартість перераховується на льоту в шарі репозиторію / маршруту, **без нових колонок і без міграцій**.

---

## Зміни в сервері

### S1. Контракт `RunStats`
Файл: `server/src/vendor/shared/contracts/trace.ts`

У `RunStats` додати:
```ts
cost_usd: z.number().nullable(),
```

### S2. Run-executor: обчислити cost і зберегти в трейс
Файл: `server/src/modules/reviews/run-executor.ts`  
Рядок ~213: розширити деструктуризацію:
```ts
const { tokensIn, tokensOut, costUsd, grounding } = outcome;
```

У блок `stats:` (рядок ~264) додати:
```ts
cost_usd: costUsd ?? null,
```

Трейс зберігається як JSONB — нове поле в `stats` з'явиться автоматично, без зміни схеми.

### S3. Контракт `RunSummary`
Файл: `server/src/vendor/shared/contracts/trace.ts`

У `RunSummary` додати:
```ts
cost_usd: z.number().nullable(),
```

### S4. Репозиторій: `listRunsForPull()` — обчислити cost
Файл: `server/src/modules/reviews/repository/run.repo.ts`

Імпортувати `estimateCost`:
```ts
import { estimateCost } from '../../../adapters/llm/pricing.js';
```

У `rows.map()` додати:
```ts
cost_usd: estimateCost(run.model ?? '', run.tokensIn ?? 0, run.tokensOut ?? 0),
```

### S5. Контракт `PrMeta`
Файл: `server/src/vendor/shared/contracts/platform.ts`  
У `PrMeta` додати:
```ts
total_cost_usd: z.number().nullable().nullish(),
```

### S6. PR list route: сумарна вартість на PR
Файл: `server/src/modules/pulls/routes.ts`

Після існуючого блоку `latestReviewByPr` (рядок ~119) додати:
```ts
const totalCostByPr = new Map<string, number | null>();
if (prIds.length > 0) {
  const runRows = await container.db
    .select({
      prId: t.agentRuns.prId,
      model: t.agentRuns.model,
      tokensIn: t.agentRuns.tokensIn,
      tokensOut: t.agentRuns.tokensOut,
    })
    .from(t.agentRuns)
    .where(and(inArray(t.agentRuns.prId, prIds), eq(t.agentRuns.status, 'done')));

  for (const rr of runRows) {
    if (!rr.prId) continue;
    const c = estimateCost(rr.model ?? '', rr.tokensIn ?? 0, rr.tokensOut ?? 0);
    const prev = totalCostByPr.get(rr.prId);
    // null + anything = null (unknown price poisons the sum)
    totalCostByPr.set(rr.prId, prev === undefined ? c : (prev == null || c == null ? null : prev + c));
  }
}
```

Імпортувати `estimateCost` в routes.ts. У `rows.map()` повернути:
```ts
total_cost_usd: totalCostByPr.get(r.id) ?? null,
```

---

## Зміни в клієнті

> Нагадування: `client/src/vendor/shared/` — дзеркало `server/src/vendor/shared/` — треба синхронізувати вручну.

### C1. Синхронізація vendor/shared (клієнт)
- `client/src/vendor/shared/contracts/trace.ts` — додати `cost_usd` до `RunStats` і `RunSummary`
- `client/src/vendor/shared/contracts/platform.ts` — додати `total_cost_usd` до `PrMeta`

### C2. Хелпер `formatCost()`
Файл: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/helpers.ts`

```ts
/** Compact USD display; null → "—" (not "$0.00"). */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null) return '—';
  return `$${usd.toFixed(4)}`;
}
```

### C3. Компонент `RunCostInline`
Файл: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunCostInline.tsx`

Вбудований inline-блок для таймлайну (Екран 2):
```tsx
export function RunCostInline({ run }: { run: RunSummary }) {
  const total = (run.tokens_in ?? 0) + (run.tokens_out ?? 0);
  const costStr = run.cost_usd != null ? ` · $${run.cost_usd.toFixed(4)}` : '';
  return (
    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
      {total.toLocaleString()} tok{costStr}
    </span>
  );
}
```

Додати до блоку правої частини рядка (де `ran_at`) у `RunHistory.tsx`.

### C4. Екран 1 — PR list: нова колонка COST

**`constants.ts`**: 
- `GRID` змінити з `"1fr 132px 92px 60px 118px 78px"` на `"1fr 132px 92px 60px 118px 72px 78px"`
- До `COLUMN_KEYS` додати `"cost"` перед `"updated"`

**`PRRow.tsx`**: додати нову `<div>` після `scoreCell` і перед `updatedCell`:
```tsx
<div style={s.costCell}>
  {pr.total_cost_usd != null
    ? <span style={s.costValue}>${pr.total_cost_usd.toFixed(4)}</span>
    : <span style={s.muted}>—</span>
  }
</div>
```

**`styles.ts`**: додати:
```ts
costCell: { fontSize: 12, color: 'var(--text-muted)' } satisfies CSSProperties,
costValue: { fontVariantNumeric: 'tabular-nums' } satisfies CSSProperties,
```

**i18n** (`messages/en/prReview.json`):  
У `list.columns` додати: `"cost": "Cost"`

### C5. Екран 3 — RunTraceDrawer Stats: плитка COST

**`TraceBody.tsx`**: у `<div style={s.statsRow}>` між `Stat tokens` і `Stat findings` додати:
```tsx
<Stat label={t("trace.stat.cost")} val={formatCost(stats.cost_usd)} />
```

Імпортувати `formatCost` з `../../helpers`.

**i18n** (`messages/en/runs.json`):  
У `trace.stat` додати: `"cost": "COST"`

---

## Порядок реалізації (рекомендований)

```
S1 → S2              # RunStats контракт + run-executor (cost у трейс)
S3 → S4              # RunSummary контракт + listRunsForPull (обчислення)
S5 → S6              # PrMeta контракт + PR list route (агрегація)
C1                   # sync vendor/shared у клієнті
C2                   # утиліта formatCost
C3 → Екран 2         # inline cost у RunHistory
C4 → Екран 1         # COST колонка у списку PR
C5 → Екран 3         # COST плитка у RunTraceDrawer
```

---

## Межові випадки

- **Seeded / старі дані** — `model`, `tokens_in`, `tokens_out` вже збережені для існуючих рядків. `estimateCost()` одразу поверне правильне значення без будь-яких backfill-ів.
- **Невідома модель** — `estimateCost()` повертає `null`; це зберігається як `NULL` у БД і рендериться як `—`.
- **Failed/cancelled runs** — `completeAgentRun()` викликається з `costUsd` і для таких статусів; бажано зберігати `null` (часткова вартість спотворює картину), але передавати `outcome.costUsd` якщо він є — прийнятне рішення (узгодити при реалізації).
- **`sql` helper** — `drizzle-orm` потребує `sql` з `drizzle-orm` для `SUM()` у PR route; переконатись у імпорті.

---

## Файли, яких НЕ потрібно чіпати

- `server/src/db/migrations/` — жодних нових файлів
- `server/src/db/schema/runs.ts` — схема не змінюється
- `server/src/modules/reviews/repository/run.repo.ts` → `completeAgentRun()` — не потребує `costUsd` аргументу
- `reviewer-core/src/review/run.ts` — `ReviewOutcome.costUsd` вже є
- `server/src/adapters/llm/pricing.ts` — `estimateCost()` вже є
- `server/src/adapters/llm/openai.ts`, `anthropic.ts` — вже повертають `costUsd`
- `client/src/lib/hooks/reviews.ts` — `usePrRuns()` автоматично підхопить нове поле
