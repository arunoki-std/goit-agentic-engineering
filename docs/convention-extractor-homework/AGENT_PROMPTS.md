# Conventions Extractor — послідовні промпти для агента

Цей файл розбиває `TASK.md` на окремі задачі, які варто давати агенту по черзі. Не давай наступний промпт, поки попередній не реалізований, не пройшов перевірки і ти руками не подивився результат у DevDigest.

## Важливий контекст для кожного промпта

Перед кожною задачею агент має врахувати це:

- Проєкт не є pnpm workspace. `server/`, `client/`, `reviewer-core/`, `e2e/` мають окремі `package.json` і lockfile.
- Перед роботою прочитати `INSIGHTS.md` у корені та релевантний module-level `INSIGHTS.md`.
- Міграції не застосовуються на старті сервера: після змін схеми треба запускати `cd server && pnpm db:migrate`.
- Shared contracts живуть у `server/src/vendor/shared`; клієнт також має vendored shared copy, тож після зміни shared contract перевірити, чи не треба синхронізувати відповідний файл у `client/src/vendor/shared`.
- У проєкті вже є таблиця `conventions` у `server/src/db/schema/knowledge.ts`, але вона може бути замала для домашки: не створюй дубль-таблицю, дороби існуючу схему міграцією.
- У `repo-intel` вже є `container.repoIntel.getConventionSamples(repoId, n)`.
- Для LLM structured output використовуй `container.llm(provider).completeStructured(...)` і Zod-схему, а не парсинг вільного тексту.
- Для моделі Conventions дивись feature-models: `server/src/modules/settings/feature-models.ts` і shared registry `FEATURE_MODELS`.
- Fastify static routes завжди реєструвати перед `/:id` routes.
- У shell-командах шляхи Next.js типу `[repoId]` / `[id]` брати в лапки.
- Дизайн-орієнтир: `specs/convention-extractor-homework/mockups/convensions - main screen.png` і `convensions - create skill screen.png`.

---

## Промпт 1 — Backend contract, schema, routes skeleton

```text
Ти працюєш у DevDigest. Реалізуй backend основу для Conventions Extractor без LLM-аналізу поки що.

Контекст:
- Прочитай кореневий INSIGHTS.md і server/INSIGHTS.md.
- Прочитай TASK.md у specs/convention-extractor-homework/TASK.md.
- У server/src/db/schema/knowledge.ts уже є таблиця conventions. Не створюй дубль.
- Existing shared ConventionCandidate є у server/src/vendor/shared/contracts/knowledge.ts.

Задача:
1. Перевір існуючу таблицю conventions і дороби її, якщо потрібно для фічі:
   - category або kind кандидата;
   - evidence_path;
   - evidence_line;
   - evidence_snippet;
   - confidence;
   - accepted;
   - created_at / scan timestamp, якщо UI має показувати last scan.
2. Додай міграцію для нових колонок без руйнування наявних даних.
3. Додай/онови shared contract для кандидата conventions так, щоб API і client могли типізовано працювати з:
   id, category, rule, evidence_path, evidence_line, evidence_snippet, confidence, accepted.
4. Створи backend module `server/src/modules/conventions/`:
   - repository.ts: тільки Drizzle queries, workspace-scoped;
   - service.ts: бізнес-логіка list/update;
   - routes.ts: HTTP layer.
5. Додай routes:
   - GET /repos/:id/conventions — повертає кандидати для repo у workspace;
   - PATCH /repos/:id/conventions/:conventionId — дозволяє змінити accepted і rule.
6. Зареєструй module у server/src/modules/index.ts.
7. Додай мінімальні server unit tests на repository/service/routes із workspace scoping.

Обмеження:
- Не реалізуй LLM extraction у цьому промпті.
- Не роби UI.
- Не змінюй unrelated files.

Перевірки:
- cd server && pnpm typecheck
- cd server && pnpm test -- conventions
- cd server && pnpm db:migrate

Після виконання коротко напиши:
- які endpoints додані;
- які поля є у ConventionCandidate;
- яку ручну перевірку треба зробити через API.
```

Що протестувати в DevDigest після промпта:

- Запустити `./scripts/dev.sh` або вручну API + DB.
- Переконатися, що міграція проходить без помилок.
- Через curl/Postman перевірити `GET /repos/<repoId>/conventions`: поки може бути порожній список, але не 404/500.

---

## Промпт 2 — Extraction pipeline: samples, LLM, evidence validation

```text
Продовжуй Conventions Extractor. Реалізуй backend extraction pipeline для POST /repos/:id/conventions/extract.

Контекст:
- Попередній промпт уже додав module conventions і list/update routes.
- У repo-intel є `container.repoIntel.getConventionSamples(repoId, n)`.
- У repos table є clone path; samples треба читати з локального clone, не з GitHub API.
- Для LLM використовуй `completeStructured` із Zod-схемою.

Задача:
1. Додай route POST /repos/:id/conventions/extract.
2. У service реалізуй збір sample context:
   - конфіги: package.json, tsconfig*.json, eslint.config.*, .eslintrc*, prettier.config.*, .prettierrc* якщо існують;
   - top-12 файлів з `container.repoIntel.getConventionSamples(repoId, 12)`;
   - обмежуй розмір контексту, щоб не відправити весь репозиторій.
3. Створи Zod schema для LLM response:
   candidates: масив об'єктів із category, rule, evidence { path, line }, confidence.
4. Prompt до LLM має просити тільки conventions, які видно з evidence, і не вигадувати правила без файлу та рядка.
5. Після LLM зроби deterministic evidence validation:
   - repo-relative file exists у clone;
   - line number існує;
   - evidence_snippet береться з реального файлу;
   - кандидати без валідного evidence відкидаються.
6. Збережи тільки валідні кандидати в conventions table.
7. Для re-scan зроби зрозумілу поведінку: або замінити попередні candidates для repo, або зберегти scan timestamp. Обери простий варіант і задокументуй у коментарі/service.
8. Додай tests із mock LLM і fake repo files:
   - валідний candidate зберігається;
   - неіснуючий файл відкидається;
   - line out of range відкидається;
   - confidence нормалізується/валідується у межах 0..1.

Обмеження:
- Не роби UI.
- Не викликай реальний LLM у тестах.
- Не обходь repo-intel новою індексацією.

Перевірки:
- cd server && pnpm typecheck
- cd server && pnpm test -- conventions

Після виконання коротко напиши:
- як формується sample context;
- яка поведінка re-scan;
- які invalid candidates відкидаються.
```

Що протестувати в DevDigest після промпта:

- Відкрити Settings і переконатися, що LLM key/model налаштовані.
- На repo, який уже cloned/indexed, викликати `POST /repos/<repoId>/conventions/extract`.
- Потім `GET /repos/<repoId>/conventions` має показати реальні candidates з path, line, snippet.
- Перевірити, що snippet справді існує у локальному файлі repo.

---
FIX 1.
Перед переходом до Prompt 3 виправ якість extraction:

1. Evidence validation не має пропускати candidates з порожнім або whitespace-only evidence_snippet. Якщо evidence_line існує, але рядок порожній, candidate треба відкинути або замінити evidence на найближчий непорожній рядок тільки якщо це безпечно й детерміновано.

2. Confidence зараз всюди 1.0. Онови prompt/schema handling так, щоб confidence була каліброваною:
   - 0.9-1.0 тільки для правил, прямо підтверджених config або повторюваним патерном у кількох файлах;
   - 0.7-0.89 для добре видимого патерну з одним сильним evidence;
   - нижче 0.7 для слабших припущень.
   Не став 1.0 за замовчуванням.

3. Додай/онови tests:
   - blank evidence line is rejected;
   - whitespace-only evidence line is rejected;
   - extraction does not default missing/invalid confidence to 1.0.

Після цього повтори manual test і покажи:
- скільки candidates мають blank snippets;
- distribution confidence values.

---
FIX 2
Extraction still stores candidates whose evidence line is non-empty but does not semantically support the rule.

Fix evidence quality:

1. Tighten the LLM prompt:
   - evidence.line must point to the exact line that demonstrates the rule;
   - do not cite nearby comments, braces, `try {`, `});`, object fields, or unrelated lines;
   - for naming rules, evidence must include the named symbol/type/interface/const;
   - for typing rules, evidence must include the typed declaration/signature/generic;
   - for imports rules, evidence must include the import/export line;
   - for documentation rules, evidence may cite comment lines.

2. Add deterministic weak-evidence filtering:
   - reject snippets that are only braces/punctuation/control-flow wrappers like `try {`;
   - reject comment snippets for non-documentation rules unless the rule is specifically about comments;
   - reject snippets like `});` or generic object fields when the rule is about naming/types/imports.

3. Add tests:
   - naming rule with comment evidence is rejected;
   - typing rule with `try {` evidence is rejected;
   - documentation rule with comment evidence is allowed;
   - imports rule with import/export evidence is allowed.

4. Re-run extraction and report:
   - number of candidates;
   - examples of 5 candidates where rule and evidence line clearly match.
---

## Промпт 3 — Create skill from accepted conventions API

```text
Додай backend API для створення skill із accepted convention candidates.

Контекст:
- Skills module уже є: server/src/modules/skills/.
- SkillsRepository підтримує source='extracted' і evidenceFiles.
- Agents module уже вміє лінкувати skills через POST /agents/:id/skills.
- Conventions candidates уже зберігаються і мають accepted.

Задача:
1. Додай endpoint для preview:
   - POST /repos/:id/conventions/skill-preview
   - бере accepted candidates або explicit candidate_ids з body;
   - повертає default name, description, type='convention', enabled=true, body markdown, token_count.
2. Додай endpoint для create:
   - POST /repos/:id/conventions/skill
   - body: name, description, type, enabled, body, optional agent_id.
   - створює skill через SkillsService/SkillsRepository з source='extracted' і evidenceFiles.
   - якщо agent_id переданий, лінкує skill до агента через AgentsService існуючим механізмом.
3. Markdown body має бути придатним для reviewer agent:
   - заголовок з repo name;
   - коротка інструкція "Flag changes that violate these rules and cite file:line";
   - по секції на кожну convention;
   - evidence file:line і snippet для traceability.
4. Rejected candidates не мають потрапляти у preview/create.
5. Додай tests:
   - preview включає тільки accepted;
   - create зберігає skill із source extracted;
   - rejected не потрапляє в markdown;
   - optional agent link створює agent_skill link.

Обмеження:
- Не роби UI.
- Не дублюй логіку SkillsService, використовуй існуючі репозиторії/сервіси.

Перевірки:
- cd server && pnpm typecheck
- cd server && pnpm test -- conventions
- cd server && pnpm test -- skills

Після виконання коротко напиши:
- shape preview response;
- shape create request;
- як agent_id лінкує skill.
```

Що протестувати в DevDigest після промпта:

- PATCH кілька candidates у `accepted=true`, один залишити rejected.
- Викликати preview і перевірити, що rejected відсутній у markdown.
- Викликати create, потім відкрити Skills API/UI і побачити новий skill типу `convention`.
- Якщо передав `agent_id`, перевірити в Agent editor -> Skills, що skill linked.

---

## Промпт 4 — Client hooks, route, navigation entry

```text
Додай client foundation для Conventions page без фінального дизайну.

Контекст:
- Client Next.js app router.
- Існуючі hooks живуть у client/src/lib/hooks/.
- API client: client/src/lib/api.ts.
- Shell уже має activeKeyFor для /conventions, але NAV може не мати пункту.
- Route має бути repo-specific: /repos/[repoId]/conventions.
- Мокапи лежать у specs/convention-extractor-homework/mockups/.

Задача:
1. Додай `client/src/lib/hooks/conventions.ts`:
   - useConventions(repoId)
   - useExtractConventions(repoId)
   - useUpdateConvention(repoId)
   - useConventionSkillPreview(repoId)
   - useCreateConventionSkill(repoId)
   - invalidate правильні React Query keys після mutation.
2. Експортуй hooks з `client/src/lib/hooks/index.ts`, якщо такий патерн використовується.
3. Додай NAV item у `client/src/vendor/ui/nav.ts`:
   - section SKILLS LAB;
   - key conventions;
   - label Conventions;
   - icon зі списку доступних lucide icons;
   - href /repos/:repoId/conventions.
4. Створи page route `client/src/app/repos/[repoId]/conventions/page.tsx`.
5. Page має:
   - AppShell crumb: Skills Lab > Conventions;
   - брати repoId з params;
   - показувати loading/error/empty states;
   - мати кнопку Scan/Re-scan, яка викликає POST extract.
6. Поки без pixel-perfect cards: достатньо списку з rule, evidence path:line, confidence, accepted.

Обмеження:
- Не реалізуй modal create skill у цьому промпті.
- Не роби великий custom design, тільки functional skeleton.

Перевірки:
- cd client && pnpm typecheck
- cd client && pnpm test

Після виконання коротко напиши:
- route URL;
- які hooks додані;
- що видно на empty/loading/error states.
```

Що протестувати в DevDigest після промпта:

- Відкрити `http://localhost:3000/repos/<repoId>/conventions`.
- Sidebar має підсвічувати Conventions.
- На порожньому repo state має бути зрозумілий empty state.
- Scan/Re-scan викликає backend і після завершення список оновлюється.

---

## Промпт 5 — Conventions list UI: accept/reject/edit/evidence links

```text
Доведи Conventions main screen до функціонального UI за мокапом.

Контекст:
- Foundation route/hooks уже є.
- Мокап main screen: specs/convention-extractor-homework/mockups/convensions - main screen.png.
- Існує `client/src/lib/github-urls.ts` для blob links.
- UI components у @devdigest/ui; використовуй Button/Icon/Skeleton/ErrorState/EmptyState, не вигадуй новий дизайн-системний шар.

Задача:
1. Зроби список candidates як cards:
   - rule headline;
   - category badge, якщо category є;
   - evidence path:line;
   - code snippet у mono block;
   - confidence bar + percent;
   - Accepted / Reject controls.
2. Accept/reject мають одразу робити PATCH і оптимістично або після success оновлювати UI.
3. Додай edit конкретного insight:
   - inline edit або small modal для `rule`;
   - save викликає PATCH;
   - cancel повертає попередній текст.
4. Додай bulk state:
   - "N of M accepted";
   - Deselect all / Select all для candidates.
5. Evidence має бути клікабельним GitHub blob link:
   - використовуй repo full_name і default branch або sha, який доступний у repo data;
   - якщо sha недоступний, використовуй default_branch;
   - line anchor має вести на evidence_line.
6. Create skill button disabled, якщо немає accepted candidates.
7. Re-scan button має показувати pending state і не дозволяти double-submit.
8. UI має бути responsive без overlap на desktop і mobile.

Обмеження:
- Не реалізуй create-skill modal у цьому промпті.
- Не додавай marketing/landing content.

Перевірки:
- cd client && pnpm typecheck
- cd client && pnpm test
- Візуально перевірити сторінку на desktop і вузькому viewport.

Після виконання коротко напиши:
- які interactions працюють;
- як будується GitHub evidence link;
- що саме треба перевірити вручну.
```

Що протестувати в DevDigest після промпта:

- Натиснути Re-scan і дочекатися candidates.
- Accepted/Reject змінюють лічильник.
- Edit rule -> Save оновлює текст після reload.
- Evidence link відкриває GitHub на реальному файлі й рядку.
- Якщо всі rejected, Create skill disabled.

---

## Промпт 6 — Create skill modal UI

```text
Реалізуй modal "Create skill from conventions" за мокапом.

Контекст:
- Backend має skill-preview і skill create endpoints.
- Main screen уже має accepted candidates.
- Мокап modal: specs/convention-extractor-homework/mockups/convensions - create skill screen.png.
- Skills UI вже має форми/компоненти у client/src/app/skills/_components/.

Задача:
1. При кліку Create skill:
   - викликати skill-preview;
   - відкрити modal/drawer з editable fields.
2. Modal fields:
   - name required;
   - description;
   - type select, default convention;
   - enabled toggle;
   - markdown body textarea/editor;
   - token count з preview або локального estimate, якщо API повертає.
3. У верхній info panel показати:
   - "Merged from N accepted conventions in <repo name>";
   - все нижче editable.
4. Save/Create викликає create endpoint.
5. Після success:
   - закрити modal;
   - показати toast;
   - invalidates skills query;
   - дати користувачу зрозуміти, що skill створено в Skills Lab.
6. Cancel не має створювати skill.
7. Rejected candidates не мають з'являтись у body.
8. Додай basic component tests, якщо у client є патерн для подібних interaction tests.

Обмеження:
- Не реалізуй agent run experiment у цьому промпті.
- Не роби full markdown editor library, textarea достатньо, якщо виглядає охайно.

Перевірки:
- cd client && pnpm typecheck
- cd client && pnpm test

Після виконання коротко напиши:
- які поля editable;
- що відбувається після Create skill;
- де знайти створений skill.
```

Що протестувати в DevDigest після промпта:

- Прийняти 2-3 candidates, один rejected.
- Відкрити modal: count має відповідати accepted candidates.
- Відредагувати name/body, натиснути Cancel: skill не створюється.
- Повторити і натиснути Create skill: skill з'являється у Skills.
- Body skill не містить rejected candidates.

---

## Промпт 7 — Link created skill to agent and reviewer flow

```text
Заверши product flow: створений conventions skill має легко потрапляти в agent review flow.

Контекст:
- Agents already support skill links through Agent editor -> Skills and POST /agents/:id/skills.
- Backend create endpoint може вже підтримувати optional agent_id. Якщо ні, додай акуратно або зроби UI handoff на existing Agent editor.
- Acceptance criteria: generated skill can be linked to an agent and used in review.

Задача:
1. Обери найменш ризиковий UX:
   - або у Create skill modal додати optional "Link to agent" select;
   - або після створення показати action "Open Agents" / "Link in Agent editor".
2. Якщо додаєш select:
   - використай існуючий useAgents hook/API;
   - передай agent_id у create endpoint;
   - після success перевір link у Agent editor.
3. Якщо робиш handoff:
   - після success дай кнопку/посилання на Agent editor або Skills tab конкретного агента, якщо app має такий route.
4. Переконайся, що review prompt реально включає linked enabled skills:
   - знайди у review executor, де читаються `enabledBodiesForAgent`;
   - не дублюй цей механізм.
5. Додай/онови тест на те, що extracted skill linked to agent з'являється у agent skills link list.
6. Напиши короткий manual test script у коментарі PR або docs section.

Обмеження:
- Не переписуй Agent editor.
- Не змінюй review engine, якщо existing skill injection already works.

Перевірки:
- cd server && pnpm test -- agents
- cd server && pnpm test -- skills
- cd client && pnpm typecheck

Після виконання коротко напиши:
- який UX обрано;
- як перевірити, що skill linked;
- де в review flow skill підхоплюється.
```

Що протестувати в DevDigest після промпта:

- Створити conventions skill.
- Прилінкувати його до агента.
- В Agent editor -> Skills побачити linked enabled skill.
- Запустити review цим агентом на PR і переконатися, що run не падає.

---

## Промпт 8 — API Contract Reviewer experiment and demo readiness

```text
Підготуй acceptance demo для API Contract Reviewer: без skills breaking change пропускається, зі skills ловиться.

Контекст:
- Це частина критеріїв приймання домашки, але не обов'язково має бути важка продуктова фіча.
- Потрібен повторюваний сценарій для demo video і PR description.
- Reviewer-core не треба ламати; краще використати існуючий agent + linked skill flow.

Задача:
1. Створи або опиши demo skill "api-contract-reviewer" / "repo-conventions" із правилом, яке реально може ловити breaking API change.
2. Підготуй test PR або demo fixture у локальному/навчальному repo:
   - приклад breaking change: rename/remove public response field, route path, status code, або request schema без backwards compatibility.
3. Запусти/опиши два сценарії:
   - агент без linked skill;
   - той самий агент зі linked API contract skill.
4. Якщо можливо, додай e2e/manual script у specs/convention-extractor-homework/DEMO.md:
   - які кнопки натискати;
   - який repo/PR використовувати;
   - що має бути видно на відео.
5. Підготуй PR description draft:
   - що реалізовано;
   - як перевірено;
   - якість знахідок extractor;
   - known limitations.

Обмеження:
- Не вигадуй fake success у коді.
- Якщо LLM результат нестабільний, чесно зафіксуй manual expectation і зроби scenario максимально очевидним для моделі.

Перевірки:
- Feature smoke через UI від scan до created skill.
- Agent review run без skill.
- Agent review run зі skill.
- Evidence links відкривають реальний GitHub code.

Після виконання коротко напиши:
- demo сценарій по кроках;
- який breaking change використаний;
- що саме показати у відео.
```

Що протестувати в DevDigest після промпта:

- Повний шлях: Re-scan -> accept/reject -> create skill -> link to agent -> run review.
- На demo video має бути видно, що rejected candidates не потрапили у skill.
- На demo video має бути видно GitHub evidence link.
- Порівняти review без skill і зі skill на API breaking change.

---

## Опційний промпт 9 — Quality improvements for extractor

```text
Покращ якість Conventions Extractor без зміни core UX.

Контекст:
- Основна фіча вже працює.
- Додаткове завдання просить подумати, як підвищити кількість або якість знахідок.

Задача:
1. Проаналізуй false positives/false negatives на 1-2 реальних repo.
2. Запропонуй і реалізуй одне невелике покращення:
   - кращий sample selection;
   - dedupe схожих правил;
   - confidence threshold;
   - grouping by category;
   - richer config context;
   - prompt tuning для evidence-first candidates.
3. Додай tests на обране покращення.
4. Додай короткий звіт у specs/convention-extractor-homework/QUALITY_REPORT.md:
   - що було погано;
   - що змінили;
   - як це вплинуло;
   - що лишилось known limitation.

Обмеження:
- Не роби великий refactor repo-intel.
- Не додавай дорогу multi-call LLM pipeline без потреби.

Перевірки:
- cd server && pnpm typecheck && pnpm test -- conventions
- UI smoke scan на demo repo.
```

Що протестувати в DevDigest після промпта:

- Re-scan на тому самому repo до/після зміни.
- Перевірити, чи стало менше дублікатів або очевидних hallucinations.
- Перевірити, що evidence validation все ще відкидає погані candidates.

