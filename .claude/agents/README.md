# Агенти DevDigest

Цей каталог містить спеціалізованих агентів Claude Code для проекту DevDigest. Планування має три взаємовиключні маршрути: звичайна задача використовує Plan Mode, project-specific задача — ручний `@planner`, а зовнішнє дослідження — ручний `@researcher` перед `@planner`. Кожне питання має одного discovery/planning owner-а.

```
Routine/local:
[Plan Mode + built-in Explore] ──→ implementation

Project-specific:
[@planner] ──→ [implementer×N] ──checkpoint merge──→ [integrator]

Broad/external research:
[@researcher] ──Evidence Index──→ [@planner] ──→ [implementer×N] ──→ [integrator]

[test-writer]          — пише тести після реалізації
[architecture-reviewer]— перевіряє архітектуру перед PR
[plan-verifier]        — звіряє код з вимогами плану
[completion-reviewer]  — незалежно перевіряє завершену задачу перед прийняттям
[docs-creator]         — генерує документацію
```

### Вибір planning lane

| Задача | Режим головної сесії | Що запускати |
|---|---|---|
| Звичайна локальна | Plan Mode | Вбудований Explore за потреби; без `@planner` і `@researcher` |
| Project-specific / cross-package / архітектурна | Normal mode | Ручний `@planner`; без Plan Mode і окремого Explore |
| Потрібні зовнішні або широкі джерела | Normal mode | Ручний `@researcher`, потім `@planner` з Evidence Index |
| Мала механічна зміна | Normal mode | Головний агент без planning/research агентів |

Правило взаємного виключення: **Plan Mode/Explore XOR `@planner`**. Researcher ніколи не запускається автоматично.

### implementer vs integrator

| | implementer | integrator |
|---|---|---|
| Isolation | `worktree` (ізольований) | немає (main worktree) |
| Паралельність | так, disjoint scopes | ні — тільки один, після всіх хвиль |
| Scope | один самостійний зріз | cross-module wiring, центральні реєстри |
| Передумова | `baseline_sha` попередньої хвилі | checkpoint commit після злиття всіх worktree-гілок |
| Backport | `BLOCKED` якщо потрібний код не в HEAD | `BLOCKED` якщо merge не виконано |

## Стандарт discovery packet

Всі read-only агенти (researcher, planner) класифікують кожне читання за типом, щоб уникнути марних витрат context budget:

| Тип | Назва | Визначення | Ціль |
|---|---|---|---|
| Type 1 | Primary read | Читання контенту, якого ще немає в Evidence Index; встановлює нове verified claim | необмежено |
| Type 2 | Spot-check | Повторне читання вже проіндексованого контенту з reason tag | мінімізувати |
| Type 3 | Duplicate read | Повторне читання вже проіндексованого контенту без reason tag; витрачає context budget | 0 |

Дозволені reason tags для Type 2: `stale check`, `missing evidence`, `cross-check`, `implementation detail`.

Кожен read-only агент додає до свого виводу read metrics:
- **researcher** — `## Read Metrics` з підрахунком Type 1 / Type 2 / Type 3 після `## Recommended Spot-checks`.
- **planner** — `Read metrics: Type 1 = N, Type 2 = N, Type 3 = N` у розділі `## Discovery Reuse`.

Кожен task packet implementer-а повинен містити поле `Already verified evidence` — Evidence Index або зведення verified facts від попереднього Researcher або Planner; або `None`, якщо жоден discovery агент не запускався. Implementer використовує це поле замість broad re-discovery.

Acceptance thresholds для будь-якої сесії:
- Проста двофайлова задача: 0 викликів Researcher/Planner, максимум один Explore.
- Після Researcher — Planner не повторює broad discovery (Type 3 = 0 у Discovery Reuse).
- Duplicate reads без reason tag: 0 у всіх read-only агентах.
- Implementer отримує тільки owner scope, symbols і verified evidence.

---

## researcher

**Файл:** `researcher.md`  
**Модель:** claude-sonnet  
**Інструменти:** Read, Bash, WebSearch, WebFetch, AskUserQuestion  
**Режим:** лише читання — ніколи не створює та не редагує файли

### Призначення

Manual-only агент для широкого, зовнішнього або організаційного дослідження. Повертає компактний Evidence Index, який наступним кроком споживає Planner. Не є обов'язковим етапом кожної задачі.

### Коли використовувати

- Користувач явно запускає `@researcher`
- Треба дослідити зовнішню документацію, стандарти або організаційні джерела
- Потрібне широке repo-дослідження з одним чітким `Unique question`

### Коли НЕ використовувати

- Потрібно написати або змінити код — для цього є `implementer`
- Потрібно спланувати реалізацію — для цього є `planner`
- Звичайна локальна задача вже виконується в Plan Mode/Explore
- Planner або інший агент уже досліджує те саме `Unique question`

### Режим інтерв'ю

Перш ніж починати широкий пошук, агент перевіряє, чи завдання має достатній контекст. Якщо неоднозначність матеріально впливає на результат — ставить до 3 уточнювальних питань через `AskUserQuestion`. Відповідає тією ж мовою, що й запит (українська / англійська).

### Стратегія пошуку

1. Перевіряє `Unique question`, `Search scope` та already-verified evidence
2. Читає project context лише настільки, наскільки це потрібно для питання
3. Використовує `WebSearch` + `WebFetch` для зовнішніх знань
4. Повертає Evidence Index, unknowns, staleness risks і spot-check recommendations

### Формат виводу

```
## Question
## Findings
## Evidence Index — source, symbol/section, lines, verified claim
## Unknowns
## Staleness Risks
## Recommended Spot-checks
```

---

## planner

**Файл:** `planner.md`  
**Модель:** claude-sonnet (effort: high)
**Інструменти:** Read, Glob, Grep  
**Заборонено:** Write, Edit, NotebookEdit  
**Режим:** `plan` — лише читання та планування  
**Архітектурні скили:** `react-best-practices`, `onion-architecture`

### Призначення

Manual planning owner для project-specific, cross-package, ризикових або архітектурно неоднозначних задач. Запускається як `@planner` з normal mode головної сесії; не комбінується з Plan Mode або окремим Explore для того самого питання.

Якщо перед Planner працював Researcher, передайте лише його Evidence Index. Planner повторно читає код тільки для `stale check`, `missing evidence`, `cross-check` або `implementation detail`.

### Джерела контексту

Перед плануванням агент обов'язково читає:
- `INSIGHTS.md` (корінь та пакети) — нетривіальні знахідки з попередніх сесій
- `AGENTS.md` для кожного зачепленого пакету
- package README лише коли потрібні факти відсутні в уже перевіреному Evidence Index
- `TESTING.md`, якщо задача змінює поведінку або охоплює декілька пакетів

Файли пакетів: `client/` (@devdigest/web), `server/` (@devdigest/api), `reviewer-core/`, `e2e/`, `server/src/vendor/shared/`.

### Метод планування

1. Переформулює очікуваний результат, відокремлює явні вимоги від припущень
2. Трасує поточний потік запиту end-to-end: UI → API → route/service/repository → persistence → тести
3. Ділить роботу на незалежно верифіковані кроки (хвилі)
4. Паралельні задачі отримують **disjoint** набір файлів — жодного перетину

### Обов'язкова політика валідації

Для кожного кроку, який змінює поведінку, `planner` зобов'язаний додати один із трьох варіантів:
- **Automated validation** — конкретна команда або набір команд
- **Manual QA script** — короткий сценарій ручної перевірки
- **No-test justification** — явне пояснення, чому перевірка не потрібна

Поведінковими вважаються зміни в UI, API, схемах даних, маршрутах, правах доступу, review output, persistence та міжмодульних інтеграціях. Якщо автоматичний тест недоречний або занадто крихкий, `planner` має винести ручну перевірку в окрему QA-задачу, а не пропускати валідацію.

Для UI-змін візуального або інтеракційного характеру manual verification зазвичай належить QA: адаптивність, стани hover/focus, кросбраузерність, дрібні layout-регресії.

### Обов'язкові скили

| Пакет | Скил |
|-------|------|
| `client/` | `react-best-practices` |
| `server/` | `onion-architecture` |

### Формат виводу

```markdown
# Development Plan: <назва>
## Outcome / Context Checked / Scope / Assumptions
## Architecture Impact (поточний і пропонований потік)
## Implementation Steps (з owner scope, залежностями, валідацією)
## Parallel Execution (хвилі з disjoint власністю)
## Test Matrix
## Risks and Rollback
## Definition of Done
```

---

## implementer (cross-module)

**Файл:** `implementer.md`  
**Модель:** claude-sonnet (effort: high)  
**Інструменти:** Read, Write, Edit, Glob, Grep, Bash, Skill, WebSearch, WebFetch  
**Заборонено:** Agent (не породжує вкладених агентів)  
**Режим:** `acceptEdits` | фоновий (`background: true`)  
**Ізоляція:** `worktree` — працює в окремому git worktree  
**Архітектурні скили:** `react-best-practices`, `onion-architecture`

### Призначення

Запасний варіант для рідкісних задач, що одночасно зачіпають **більше одного модуля** (наприклад, client/ + server/). Завантажує обидва архітектурні скили. Для задач з одним модулем — використовуй спеціалізований варіант нижче.

### Routing за модулем

| Owner scope задачі | Агент |
|---|---|
| Лише `client/**` | **`implementer-client`** — тільки `react-best-practices` |
| Лише `server/**` | **`implementer-server`** — тільки `onion-architecture` |
| Лише `reviewer-core/**` або `e2e/**` | **`implementer-core`** — без архітектурних скилів |
| Кілька модулів одночасно | `implementer` (цей) — завантажує обидва скили |

Правило: агент не завантажує правила модулів, яких він не торкається.

### Маршрутизація скилів

| Зачеплений пакет | Обов'язковий скил | Обов'язковий локальний контекст |
|---|---|---|
| `client/**` | `react-best-practices` | `client/AGENTS.md`, `client/INSIGHTS.md` |
| `server/**` | `onion-architecture` | `server/AGENTS.md`, `server/INSIGHTS.md` |
| `reviewer-core/**` | немає | `reviewer-core/AGENTS.md`, `README.md`, `INSIGHTS.md` |
| `e2e/**` | немає | `e2e/AGENTS.md`, `README.md`, `INSIGHTS.md` |

### Правила паралельної роботи

- Змінює лише власний `owner scope`; усі інші файли — лише читання
- Не комітить, не пушить, не відкриває PR без явної вказівки в плані
- Спільні контракти, lockfile-и, міграції та центральні реєстри мають одного власника

### Незмінні обмеження проекту

- `server/src/vendor/shared/` — джерело правди для спільних контрактів
- Застосовані міграції не редагуються — генерується нова
- Drizzle — лише в репозиторіях і адаптерах (не в routes/services)
- Секрети — у `~/.devdigest/secrets.json`, ніколи в `.env` або коді
- E2E використовує `agent-browser`, не Playwright; `docker compose down -v` заборонено

### Формат виводу

```markdown
## Status         — COMPLETED | BLOCKED
## Implemented    — що і яку поведінку реалізовано
## Skills Applied — які скили застосовано
## Files Changed  — які файли змінено і навіщо
## Verification   — команди та їх результат
## Parallel Handoffs — передача іншим власникам або `None`
## Review Inputs      — spec/plan, owner scope і metadata для orchestrator-а
## Assumptions, Risks, and Follow-ups
## Insight Candidates — нетривіальні знахідки для INSIGHTS.md
```

---

## implementer-client

**Файл:** `implementer-client.md`  
**Інструменти:** Read, Write, Edit, Glob, Grep, Bash, Skill  
**Заборонено:** Agent, WebSearch, WebFetch  
**Режим:** `acceptEdits` | фоновий | ізоляція: `worktree`  
**Скил:** `react-best-practices` (тільки)

Реалізує задачі в `client/**`. Не завантажує `onion-architecture`. Якщо scope виходить за межі `client/` — повертає `BLOCKED`.

---

## implementer-server

**Файл:** `implementer-server.md`  
**Інструменти:** Read, Write, Edit, Glob, Grep, Bash, Skill  
**Заборонено:** Agent, WebSearch, WebFetch  
**Режим:** `acceptEdits` | фоновий | ізоляція: `worktree`  
**Скил:** `onion-architecture` (тільки)

Реалізує задачі в `server/**`. Не завантажує `react-best-practices`. Якщо scope виходить за межі `server/` — повертає `BLOCKED`.

---

## implementer-core

**Файл:** `implementer-core.md`  
**Інструменти:** Read, Write, Edit, Glob, Grep, Bash, Skill  
**Заборонено:** Agent, WebSearch, WebFetch  
**Режим:** `acceptEdits` | фоновий | ізоляція: `worktree`  
**Скили:** немає (reviewer-core та e2e не мають виділеного архітектурного скилу)

Реалізує задачі в `reviewer-core/**` або `e2e/**`. Читає локальні `AGENTS.md` та `INSIGHTS.md` відповідного пакету. Якщо scope виходить за межі цих двох пакетів — повертає `BLOCKED`.

---

## integrator

**Файл:** `integrator.md`
**Модель:** claude-sonnet (effort: high)
**Інструменти:** Read, Write, Edit, Glob, Grep, Bash, Skill
**Заборонено:** Agent
**Режим:** `acceptEdits` | фоновий (`background: true`)
**Ізоляція:** немає — працює в основному worktree зі вже змердженими змінами

### Призначення

Виконує фінальну інтеграцію після завершення паралельних implementer-хвиль: з'єднує barrel-exports, DI-реєстрацію, cross-module routing і спільні контракти — все, що не могло мати одного owner-а в паралельній хвилі. Після роботи запускає повний test pass і перевіряє `git diff --check`.

### Коли використовувати

- Після того як оркестратор злив усі worktree-гілки, запустив тести і зробив checkpoint commit
- Коли integration wave потребує змін у центральних реєстрах або точках монтування маршрутів

### Коли НЕ використовувати

- Паралельно з іншими write-агентами
- Без checkpoint merge — якщо worktree-гілки ще не злиті, повертає `BLOCKED`
- Для реалізації нових функцій — для цього є `implementer`

---

## test-writer

**Файл:** `test-writer.md`  
**Модель:** claude-sonnet (effort: high)  
**Інструменти:** Read, Write, Edit, Glob, Grep, Bash  
**Заборонено:** Agent  
**Режим:** `acceptEdits` — пише лише тестові файли, ніколи не змінює `src/`  
**Архітектурні скили:** `onion-architecture`, `react-best-practices`

### Призначення

Пише тести для UI-компонентів і backend-коду. Підтримує всі чотири рівні тестування проекту: hermetic-тести сервера, DB-backed інтеграційні тести, jsdom-тести клієнта і JSON-специфікації e2e. Читає один існуючий тест як зразок перед написанням нового.

Важливо: `test-writer` не заміняє ручну UI-перевірку там, де потрібен QA-сценарій. Автоматичні тести покривають логіку й типові інтеракції; візуальні, responsive і browser-specific перевірки можуть залишатися окремими manual QA tasks у плані.

### Коли використовувати

- Потрібно додати або розширити покриття тестами для модуля, маршруту, компонента або сервісу
- Після реалізації нової функціональності (`implementer` зробив свою роботу)

### Коли НЕ використовувати

- Потрібно змінити виробничий код — для цього є `implementer`
- Тест провалюється через баг у `src/` — поверни проблему у `implementer`

### Маршрутизація по рівнях тестування

| Рівень | Файл | Інструменти |
|--------|------|-------------|
| Server hermetic | `server/test/<name>.test.ts` | vitest + `app.inject()` + mocks.ts |
| Server DB-backed | `server/test/<name>.it.test.ts` | vitest + testcontainers |
| Client component | `client/src/**/*.test.tsx` | vitest + jsdom (colocated) |
| E2E flow | `e2e/specs/NN-<name>.flow.json` | JSON schema (не Playwright) |

---

## architecture-reviewer

**Файл:** `architecture-reviewer.md`  
**Модель:** claude-opus (effort: high)  
**Інструменти:** Read, Glob, Grep, Bash, Skill  
**Заборонено:** Write, Edit, Agent  
**Режим:** лише читання — ніколи не змінює файли  
**Архітектурні скили:** `onion-architecture`, `react-best-practices`

### Призначення

Перевіряє архітектурну структуру коду: порушення шарів onion-архітектури, тісне зчеплення, SOLID-проблеми, ризики масштабованості. Повертає структурований список знахідок із рівнями severity (CRITICAL / WARNING / INFO) і вердиктом BLOCKED / CONCERNS / PASSED.

### Коли використовувати

- Після реалізації великої функції, перед відкриттям PR
- Коли треба незалежна думка щодо структури нового модуля
- Якщо є підозра на порушення шарів між `server/src/` і `client/src/`

### Коли НЕ використовувати

- Потрібна перевірка тестового покриття — для цього є `test-writer`
- Потрібна перевірка виконання вимог плану — для цього є `plan-verifier`

### Що НЕ входить у скоуп

Пропуски в тестах, документація, стиль коду, іменування, мікро-оптимізації.

---

## plan-verifier

**Файл:** `plan-verifier.md`  
**Модель:** claude-sonnet (effort: high)  
**Інструменти:** Read, Glob, Grep, Bash  
**Заборонено:** Write, Edit, Agent  
**Режим:** лише читання

### Призначення

Отримує список вимог (план, специфікацію або опис задачі) і перевіряє, чи кожна вимога реалізована в коді. Повертає матрицю трасування: REQ-ID → місце реалізації або «не знайдено». Не коментує якість коду — тільки факт наявності чи відсутності реалізації.

### Коли використовувати

- Після завершення реалізації: «чи все з плану зроблено?»
- Перед PR: перевірити, що жодна вимога з тікету не пропущена
- Коли замовник або тімлід надає чеклист вимог

### Вхідний контракт

Надай агенту:
1. Список вимог (вільний текст — агент сам призначить REQ-01, REQ-02…)
2. Скоуп для пошуку (конкретні файли або «весь репозиторій»)

### Формат виводу

```
| REQ-ID | Description | Status | Location |
| REQ-01 | ...         | ✅ FOUND   | server/src/foo/service.ts:42 |
| REQ-02 | ...         | ❌ NOT FOUND | — |
| REQ-03 | ...         | ⚠️ PARTIAL | client/src/bar/page.tsx:15 |
```

---

## completion-reviewer

**Файл:** `completion-reviewer.md`
**Модель:** claude-sonnet (effort: medium)
**Інструменти:** Read, Glob, Grep, Bash
**Заборонено:** Write, Edit, NotebookEdit, Agent
**Режим:** `plan` — лише читання

### Призначення

Незалежно перевіряє одну завершену задачу перед прийняттям або checkpoint-комітом. У поточній сесії отримує від головного агента original prompt, approved plan, handoff-звіти субагентів, validation evidence і working-tree diff; для повторного рев'ю може використовувати commit, spec або transcript.

### Коли використовувати

- Після завершення окремої задачі, до commit/checkpoint
- Перед checkpoint або прийняттям результату агента
- Коли треба відрізнити фактично виконані перевірки від запланованих чи заявлених

### Виклик

```text
/review-task
```

Аргументи не потрібні, коли задача щойно виконана в активному чаті. Для повторного запуску з іншої сесії можна передати будь-які доступні артефакти:

```text
/review-task <commit> <spec> "<session-export>"
```

Skill `.claude/skills/review-task/SKILL.md` спочатку формує review packet із поточного контексту, а потім делегує незалежному reviewer-у. Агент не виправляє знайдені проблеми та повертає один вердикт: `PASS`, `CONCERNS` або `BLOCKED`.

---

## docs-creator

**Файл:** `docs-creator.md`  
**Модель:** claude-sonnet (effort: high)  
**Інструменти:** Read, Write, Edit, Glob, Grep, Bash  
**Заборонено:** Agent  
**Режим:** `acceptEdits`

### Призначення

Перетворює код, нотатки і контекст від виклику на структуровану документацію для розробників. Знає, куди писати кожен тип документа. Ніколи не вигадує поведінку — документує тільки те, що є в коді або надано явно.

### Коли використовувати

- Потрібно задокументувати нову функцію, модуль або публічний API
- Є «сирі» нотатки, які треба перетворити на документ
- Потрібно додати JSDoc до публічних експортів TypeScript

### Куди пишуться документи

| Тип контенту | Цільове місце |
|--------------|---------------|
| Огляд функції / модуля | `docs/<feature-name>.md` |
| Правила модуля і gotcha | `<module>/AGENTS.md` (append) |
| Публічний TypeScript API | inline JSDoc в source-файлі |
| Лабораторні матеріали | `docs/lab-<N>/` |
| Транскрипти сесій | `docs/sessions/` |
| README пакету | `<package>/README.md` |

### Критерії якості (застосовуються до кожного документа)

- **Completeness** — всі публічні API і налаштування описані
- **Helpfulness** — хоча б один практичний приклад на кожен API
- **Truthfulness** — нічого не описується, що не підтверджено кодом

---

## Джерела та пов'язані файли

| Файл | Роль |
|------|------|
| [`../../AGENTS.md`](../../AGENTS.md) | Головний опис стеку, пакетів та правил сесії |
| [`../../CLAUDE.md`](../../CLAUDE.md) | Точка входу; підключає `AGENTS.md` |
| `*/INSIGHTS.md` | Нетривіальні знахідки по кожному пакету — агенти читають їх перед роботою |
| `*/AGENTS.md` | Локальні правила кожного пакету |

Скили, на які посилаються агенти (`react-best-practices`, `onion-architecture`, `engineering-insights`, `pr-self-review`), визначені в `.claude/` і доступні через інструмент `Skill`.

## Завершення задачі та незалежне рев'ю

Після user-facing summary головна сесія пропонує рев'ю, але не запускає його автоматично:

```text
/review-task
```

Команда бере вимоги, план, результати інструментів і handoff-и субагентів із поточного чату та перевіряє незакомічений результат. `/save-session` потрібен лише для архіву або повторного cross-session review. Worktree-Implementer повертає `Review Inputs`, а orchestrator додає їх до review packet. Completion-reviewer також перевіряє discovery hygiene згідно зі [Стандартом discovery packet](#стандарт-discovery-packet): наявність `Already verified evidence` в packet, відсутність Type 3 duplicate reads, та read metrics у `## Discovery Reuse` плану.
