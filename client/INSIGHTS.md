# INSIGHTS.md — client/ (@devdigest/web)

Next.js 15 App Router · TanStack Query · next-intl · recharts

Entry format: `[YYYY-MM-DD] <finding> — <file:line if applicable>`
Rules: append-only; correct with a dated note, never overwrite; terse + actionable "cold".
Prune quarterly.

---

## What Works

<!-- Підходи й рішення, що спрацювали в client/ -->

## What Doesn't Work

<!-- Глухі кути й антипатерни — найцінніша секція -->
<!-- Приклад: [2026-06-19] fetch() напряму в компоненті — ламає кеш TanStack Query; завжди через src/lib/hooks/ -->
[2026-06-22] Передавати фільтр-параметр у queryKey TanStack Query = окремий cache entry на кожне значення → ламає deduplication; фільтрувати client-side у helpers.ts на вже отриманих даних — AgentsListView/helpers.ts
[2026-06-22] `useSearchParams` для фільтра — тільки якщо значення має виживати після рефреш або бути shareable; якщо ні — `useState`; прецедент URL-стану: src/app/repos/[repoId]/pulls/page.tsx, без URL-стану: agents list

## Codebase Patterns

<!-- Non-default конвенції client/ -->
<!-- Приклад: [2026-06-19] Сторінки тонкі — вся логіка в _components/<Name>/; не класти бізнес-логіку в page.tsx -->
[2026-06-22] RunTraceDrawer — канонічний прецедент вкладених _components/ (TraceBody, FindingsSection, PromptBlock тощо); орієнтуватись на нього при розбитті великих компонентів — src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/

## Tool & Library Notes

<!-- Квірки Next.js 15, TanStack Query, next-intl -->

## Recurring Errors & Fixes

<!-- Повторювані помилки + фікс -->
<!-- Приклад: [2026-06-19] Контракти розсинхронізувались — src/vendor/shared/ ≠ server/src/vendor/shared/ -->

## Session Notes

<!-- Датовані підсумки сесій -->

[2026-06-19] Severity filter bar in FindingsTab uses local state (not URL) initialized from `initialSeverity` prop; clicking an already-active badge toggles back to "all" via `prev === sev ? null : sev` — FindingsTab.tsx:49

## Open Questions

<!-- Що лишилось нез'ясованим -->
