# HW2: Conventions Extractor + API Contract Reviewer

## Коротко

У цьому PR реалізовано фічу **Conventions Extractor** для DevDigest: застосунок сканує репозиторій, знаходить потенційні code conventions з evidence у реальному коді, дозволяє accept/reject/edit candidates і створює з accepted правил DevDigest skill.

Друга частина домашки — експеримент з **API Contract Reviewer**: створено demo skill і agent-а, який отримує ці правила як linked skill під час PR review. Мета цієї частини — показати, що skill реально потрапляє в prompt reviewer-а і змінює поведінку agent-а.

## Моя роль і роль Codex

Я виконував домашнє завдання як навчальний full stack flow: перевіряв API через `curl`, тестував UI у DevDigest, відбирав якісні convention candidates і запускав reviewer agent-а на PR.

**Codex використовувався як технічний pair-programming асистент**:

- допоміг розбити велику задачу з `TASK.md` на послідовні agent prompts;
- пояснював backend/API терміни: migrations, `curl`, endpoint-и, `repoId`, preview/create flow;
- допомагав аналізувати результати extractor-а і відрізняти good evidence від слабкого evidence;
- допоміг підготувати `DEMO.md`, `PR_DESCRIPTION.md` і manual verification сценарій;
- допоміг інтерпретувати run trace API Contract Reviewer-а, зокрема випадок `Skills: 1 skill(s) attached`, але `0 candidate finding(s)`.

Код і перевірки виконувалися в межах цього DevDigest repo, з ручною валідацією результатів у UI.

## Що реалізовано

### Backend

- `GET /repos/:id/conventions` — список convention candidates для repo.
- `POST /repos/:id/conventions/extract` — extraction pipeline:
  - бере config файли і source samples через `repoIntel.getConventionSamples`;
  - викликає LLM зі structured output;
  - валідовує evidence по реальних файлах;
  - відкидає candidates без файлу, рядка, snippet або з weak evidence;
  - re-scan замінює попередні candidates, не накопичує дублікати.
- `PATCH /repos/:id/conventions/:conventionId` — accept/reject/edit rule.
- `POST /repos/:id/conventions/skill-preview` — збирає markdown preview skill-а тільки з accepted candidates.
- `POST /repos/:id/conventions/skill` — створює skill із `source: "extracted"` і, опційно, лінкує його до agent-а.

### Client

- Додано сторінку:

  ```text
  /repos/[repoId]/conventions
  ```

- UI підтримує:
  - Run extraction / Re-scan;
  - список candidates;
  - category, rule, confidence, code snippet;
  - GitHub evidence links;
  - Accept / Reject;
  - edit rule;
  - Create skill modal;
  - Link to agent select.

### Demo / Docs

- `specs/convention-extractor-homework/DEMO.md` — покроковий сценарій demo.
- `specs/convention-extractor-homework/QUALITY_REPORT.md` — короткий звіт по якості extractor-а.
- `specs/convention-extractor-homework/fixtures/api-contract-reviewer-skill.md` — demo skill для API Contract Reviewer.
- `specs/convention-extractor-homework/fixtures/demo-payments-api.ts` — fixture з навмисними breaking API contract changes.
- `specs/convention-extractor-homework/AGENT_PROMPTS.md` — декомпозиція всієї домашки на послідовні prompts для agent-а.

## Як перевірити Conventions Extractor

1. Запустити DevDigest:

   ```sh
   ./scripts/dev.sh
   ```

2. Переконатися, що repo доданий і має `clone_path`:

   ```sh
   curl http://localhost:3001/repos | jq '.[] | {id, full_name, clone_path}'
   ```

3. Відкрити у UI:

   ```text
   http://localhost:3000/repos/<repoId>/conventions
   ```

4. Натиснути **Run extraction**.

5. Перевірити:
   - candidates зʼявляються;
   - evidence має реальний `file:line`;
   - GitHub evidence link відкриває реальний код;
   - можна accept/reject;
   - rejected candidates не потрапляють у skill preview.

6. Створити skill через **Create skill**.

7. Відкрити **Skills** і переконатися, що створився skill типу `convention`.

## Приклади хороших candidates

При ручній перевірці good candidates були ті, де rule і evidence прямо збігаються:

- `Type-only imports use import type`
  - evidence: `import type { CSSProperties } from "react";`
- `Barrel files re-export modules using export * from './module'`
  - evidence: `export * from "./core";`
- `API errors are normalized and thrown as ApiError`
  - evidence: `throw new ApiError(`
- `Single quotes are used for string literals in server-side code`
  - evidence: import з single quotes у server-side file.

Weak candidates відхилялися вручну, якщо evidence був занадто загальним або не доводив rule.

## API Contract Reviewer experiment

Було створено agent-а **API Contract Reviewer** і linked skill **API Contract Reviewer Rules**.

У run trace видно, що skill реально підключається:

```text
Skills: 1 skill(s) attached
```

Це підтверджує головну інтеграцію:

```text
PR diff -> reviewer agent -> linked skill in prompt -> LLM review -> findings in UI
```

Важливе спостереження: якість findings залежить від розміру PR, model і strategy. На великому homework PR (`40+ changed files`, великий one-pass prompt) agent може:

- не знайти expected breaking change;
- або видати noisy findings по unrelated files.

Це не означає, що skill linking не працює. Це показує реалістичну особливість agentic workflows: prompt/skill/eval треба ітерувати.

Для стабільнішого demo у `DEMO.md` описані два варіанти:

- перемкнути agent strategy на `map-reduce`;
- або створити маленький demo PR, де diff майже повністю складається з API breaking fixture.

## Що було перевірено

- Backend tests: усі тести проходили після реалізації extraction і skill flow.
- Manual API verification:
  - `GET /repos/:id/conventions`;
  - `POST /repos/:id/conventions/extract`;
  - `PATCH accepted=true`;
  - `POST /skill-preview`;
  - `POST /skill`.
- Manual UI verification:
  - Conventions page;
  - accept/reject;
  - Create skill modal;
  - Skills page;
  - Agent run trace with linked skill.

## Known limitations

- LLM candidates можуть мати weak semantic evidence, тому accept/reject людиною є важливою частиною flow.
- Re-scan замінює всі candidates і не зберігає manual edits.
- Extractor бачить тільки sampled files, а не весь repo.
- API Contract Reviewer demo skill працює як навчальний proof-of-flow; production quality потребує точнішого prompt-а, focused eval set і стабільнішого demo PR.
- На великому PR one-pass review може пропустити маленький demo fixture. Для demo краще використовувати `map-reduce` або маленький PR.

## Demo video

Link:

```text
[to be added]
```

Покроковий сценарій:

```text
specs/convention-extractor-homework/DEMO.md
```

