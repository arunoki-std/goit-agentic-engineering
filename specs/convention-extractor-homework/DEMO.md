# HW2 Demo Guide — Conventions Extractor + API Contract Reviewer

Цей документ пояснює, як руками перевірити домашку і що саме показати на demo video.

Головна ідея:

1. **Conventions Extractor** працює на рівні репозиторію: сканує repo, показує candidates, дозволяє accept/reject, створює skill.
2. **API Contract Reviewer** перевіряється на pull request: запускаємо того самого agent-а **без skill**, потім **зі skill**, і порівнюємо результат.

---

## 0. Терміни простими словами

- **Repo** — GitHub repository, який DevDigest додав і склонював локально.
- **PR / Pull Request** — зміни в GitHub, які DevDigest може завантажити і віддати agent-у на review.
- **Agent** — ревʼювер у DevDigest: system prompt + model + linked skills.
- **Skill** — додаткові правила, які додаються в prompt agent-а перед diff.
- **API Contract Reviewer skill** — markdown-правила, які кажуть agent-у: rename/remove response fields, status code changes, route changes are breaking API changes.

---

## 1. Preconditions

Перед тестом має бути:

1. DevDigest запущений:

   ```sh
   ./scripts/dev.sh
   ```

2. У Settings заданий LLM provider key:
   - OpenRouter або OpenAI/Anthropic.

3. У Settings заданий GitHub token:
   - потрібен, щоб DevDigest міг бачити PR-и і diff.

4. У DevDigest доданий repo:

   ```text
   arunoki-std/goit-agentic-engineering
   ```

5. Repo має бути synced/cloned.

   Перевірити через API:

   ```sh
   curl http://localhost:3001/repos | jq '.[] | {id, full_name, clone_path, last_polled_at}'
   ```

   Для потрібного repo `clone_path` має бути не `null`.

---

## 2. Який PR використовувати для API Contract Reviewer

### Рекомендований шлях

Використовуй **реальний homework PR** із цією фічею.

Наприклад:

```text
base: main
head: lab-2
```

Цей PR уже містить demo fixture:

```text
specs/convention-extractor-homework/fixtures/demo-payments-api.ts
```

Цей файл спеціально створений як “навчальний breaking API change”, щоб agent мав що знайти.

### Якщо homework PR ще не відкритий

Відкрий PR на GitHub із поточної гілки `lab-2` у `main`.

Через GitHub CLI:

```sh
git branch --show-current
git status --short
git push -u origin lab-2
gh pr create \
  --base main \
  --head lab-2 \
  --title "HW2: Conventions Extractor + API Contract Reviewer" \
  --body-file specs/convention-extractor-homework/PR_DESCRIPTION.md
```

Якщо `gh` не налаштований, відкрий GitHub у браузері й створи PR вручну:

```text
base: main
compare: lab-2
```

Після створення запамʼятай номер PR, наприклад `#12`.

---

## 3. Підтягнути PR у DevDigest

1. Відкрий DevDigest:

   ```text
   http://localhost:3000
   ```

2. У repo switcher зліва обери:

   ```text
   arunoki-std/goit-agentic-engineering
   ```

   Не `acme/payments-api`, бо він може бути demo repo без clone.

3. Відкрий **Pull Requests**.

4. Натисни **Refresh**.

5. У списку має зʼявитися твій homework PR.

Якщо PR не зʼявився:

- перевір, що PR відкритий на GitHub;
- перевір, що `GITHUB_TOKEN` є в Settings;
- перевір, що repo у DevDigest саме `arunoki-std/goit-agentic-engineering`;
- натисни Refresh ще раз.

---

## 4. Part A — Conventions Extractor flow

Цей блок показує, що feature Conventions Extractor працює як продуктова фіча.

### 4.1 Відкрити Conventions page

1. У DevDigest обери repo `arunoki-std/goit-agentic-engineering`.
2. У sidebar відкрий **Conventions**.

Прямий URL, якщо repo id такий самий як у локальному seed:

```text
http://localhost:3000/repos/74524481-176f-4b12-9eba-078bcbe77d77/conventions
```

### 4.2 Запустити extraction

1. Натисни **Run extraction** або **Re-scan**.
2. Дочекайся списку candidates.

Після scan має бути видно:

- category;
- rule;
- evidence path + line;
- code snippet;
- confidence;
- Accept / Reject.

### 4.3 Accept / Reject

Прийми 3-5 хороших candidates.

Хороший candidate — це коли rule і evidence прямо збігаються.

Приклади хороших:

- Rule: `Type-only imports use import type`
  Evidence: `import type { CSSProperties } from "react";`

- Rule: `Barrel files re-export modules using export * from './module'`
  Evidence: `export * from "./core";`

- Rule: `API errors are normalized and thrown as ApiError`
  Evidence: `throw new ApiError(`

Відхили хоча б 1 слабкий candidate.

Слабкий candidate — це коли evidence не доводить rule, наприклад:

- rule про generics, але evidence `let res: Response`;
- rule про trailing comma, але evidence рядок без comma;
- rule про documentation, але evidence тільки `/**`.

### 4.4 Create skill

1. Натисни **Create skill**.
2. У modal перевір:
   - name заповнений;
   - type = `convention`;
   - enabled = on;
   - body містить accepted candidates;
   - rejected candidates відсутні.
3. Якщо є dropdown **Link to agent**, поки можна залишити пустим.
4. Натисни **Create skill**.
5. Відкрий **Skills** і перевір, що новий skill зʼявився.

Що показати на відео:

- candidates після scan;
- accept/reject;
- evidence link відкриває GitHub;
- modal create skill;
- rejected rule відсутній у markdown body;
- створений skill видно у Skills.

---

## 5. Part B — API Contract Reviewer experiment

Цей блок показує різницю **без skill** і **зі skill**.

Важливо: результат LLM не на 100% deterministic. Якщо agent і без skill щось знайде, це не провал. Тоді порівнюй не “знайшов/не знайшов”, а:

- без skill: vague / lower severity / неповний список;
- зі skill: конкретні API contract violations, correct severity, file:line citations.

---

## 6. Створити API Contract Reviewer agent

1. Відкрий **Agents**.
2. Натисни **New agent**.
3. Заповни:

   **Name**

   ```text
   API Contract Reviewer
   ```

   **Description**

   ```text
   Checks public API changes for backwards-compatibility violations.
   ```

   **System prompt**

   ```text
   You are an API contract reviewer. Your job is to find backwards-incompatible
   changes in this pull request that would break existing clients.

   Look for:
   - Removed or renamed response fields
   - HTTP status code changes on existing endpoints
   - URL route path changes
   - New required request fields

   For each issue, state: what changed, why it breaks clients, and cite the exact file:line.
   If you find no breaking changes, say "No breaking changes detected."

   Be direct. Do not praise the code. Only report contract violations.
   ```

4. Обери model.

   Добре для demo:

   ```text
   deepseek/deepseek-v4-flash
   ```

   Або будь-яку модель, яка у тебе реально доступна в Settings.

5. **Skills поки не додавай.**

6. Save.

Перевірка:

- В Agents має бути agent `API Contract Reviewer`.
- У нього поки немає linked skills.

---

## 7. Run review WITHOUT skill

Цей крок потрібен, щоб мати baseline.

1. Відкрий **Pull Requests**.
2. Відкрий homework PR.
3. Перейди на PR detail page.
4. Натисни **Run Review**.
5. У dropdown вибери `API Contract Reviewer`.
6. Дочекайся завершення run.
7. Відкрий findings / review result.

Що очікувати без skill:

- Може бути 0 CRITICAL findings.
- Може бути generic коментар типу “naming refactor”.
- Може пропустити:
  - `transaction_id` → `transactionId`;
  - видалення `account_number`;
  - `created_at` → `createdAt`;
  - `CREATE_PAYMENT_STATUS = 200` замість `201`.

Що записати собі:

- скільки findings;
- які severity;
- чи згадані конкретні field names;
- чи є file:line citations.

Для demo video:

- покажи, що agent запускається без linked skill;
- покажи результат першого run;
- не потрібно, щоб він був “ідеально поганий”; достатньо, щоб зі skill було помітно краще.

---

## 8. Створити API Contract Reviewer skill

Skill body уже лежить тут:

```text
specs/convention-extractor-homework/fixtures/api-contract-reviewer-skill.md
```

### Варіант через UI

1. Відкрий **Skills**.
2. Натисни **Add** / **New skill**.
3. Обери **Create new** або **From file**.
4. Якщо **From file** працює:
   - вибери `api-contract-reviewer-skill.md`.
5. Якщо простіше вручну:
   - відкрий файл у редакторі;
   - скопіюй весь markdown;
   - встав у body.
6. Заповни:

   **Name**

   ```text
   API Contract Reviewer Rules
   ```

   **Description**

   ```text
   Flags backwards-incompatible API contract changes.
   ```

   **Type**

   ```text
   convention
   ```

   **Enabled**

   ```text
   on
   ```

7. Save.

### Перевірка через API, якщо хочеш

```sh
curl http://localhost:3001/skills | jq '.[] | select(.name | contains("API Contract"))'
```

---

## 9. Link skill до API Contract Reviewer agent

1. Відкрий **Agents**.
2. Відкрий `API Contract Reviewer`.
3. Перейди на tab **Skills**.
4. Знайди `API Contract Reviewer Rules`.
5. Увімкни/link цей skill для agent-а.
6. Перевір, що він:
   - linked;
   - enabled;
   - стоїть у списку skills agent-а.

Що це означає технічно:

- при наступному review DevDigest додасть markdown skill у prompt agent-а;
- skill буде перед diff;
- agent побачить explicit rules перед тим, як читати PR changes.

---

## 10. Run review WITH skill

1. Повернися в той самий homework PR.
2. Натисни **Run Review**.
3. Знову вибери `API Contract Reviewer`.
4. Дочекайся завершення run.
5. Порівняй новий run із попереднім.

Очікуваний результат зі skill:

- agent має явно назвати breaking API changes;
- findings мають бути specific;
- severity має бути CRITICAL або WARNING;
- має бути file:line citation на `demo-payments-api.ts`.

Ідеальний результат:

- `transaction_id` renamed to `transactionId` without alias;
- `account_number` removed without deprecation;
- `created_at` renamed to `createdAt` without alias;
- create status changed from `201` to `200`.

Достатній результат для demo:

- хоча б 2-3 конкретні API contract violations;
- видно, що зі skill agent став більш точним;
- є посилання на файл/рядок.

---

## 11. Що саме порівнювати

Порівнюй не просто кількість findings, а якість.

| Без skill | Зі skill |
|----------|----------|
| generic “naming change” | конкретно “response field renamed” |
| може не бути severity | CRITICAL / WARNING |
| може не згадати clients | пояснює, чому clients break |
| може пропустити status code | ловить `201 -> 200` |
| може бути vague | цитує `file:line` |

У відео достатньо показати:

1. Agent без linked skill.
2. First run result.
3. Linked skill.
4. Second run result.
5. Різницю в конкретності.

---

## 12. Demo video script

Орієнтовна структура на 5 хвилин:

| Час | Що показати |
|-----|-------------|
| 0:00-0:30 | DevDigest, правильний repo selected, Pull Requests/Conventions доступні |
| 0:30-1:30 | Conventions → Run extraction → candidates |
| 1:30-2:20 | Accept 3, reject 1, evidence link |
| 2:20-3:00 | Create skill modal, rejected candidate absent, Create skill |
| 3:00-3:40 | API Contract Reviewer agent без skills → run review на PR |
| 3:40-4:20 | Створити/показати API Contract Reviewer Rules skill і linked agent |
| 4:20-5:00 | Run review з skill → CRITICAL/specific findings |

---

## 13. Troubleshooting

### PR не видно в DevDigest

Перевір:

```sh
gh pr list
curl http://localhost:3001/repos | jq '.[] | {id, full_name, clone_path}'
```

Потім у DevDigest:

- правильний repo selected;
- Pull Requests → Refresh;
- GitHub token є в Settings.

### Agent без skill теж знаходить breaking changes

Це нормально. Модель може здогадатися сама.

Тоді у demo кажи:

```text
Без skill модель іноді здогадується, але зі skill результат стає стабільнішим:
правильна severity, конкретні field names, API-contract формулювання і file:line.
```

### Agent зі skill не знаходить усі 4 зміни

Це теж можливо.

Що зробити:

1. Перезапусти review тим самим agent-ом.
2. Перевір, що skill enabled і linked.
3. Відкрий run trace, якщо доступний, і переконайся, що skill body є у prompt.
4. Спробуй сильнішу модель.

Для demo достатньо, щоб зі skill було явно краще, ніж без skill.

### Findings не мають file:line citation

Можлива причина: grounding gate пропускає тільки рядки, які є в PR diff.

Саме тому demo fixture — новий файл:

```text
specs/convention-extractor-homework/fixtures/demo-payments-api.ts
```

Новий файл повністю входить у diff, тому всі його рядки groundable.

### Conventions page показує empty state

Перевір, що selected repo — не `acme/payments-api`, а:

```text
arunoki-std/goit-agentic-engineering
```

І що repo має `clone_path`.

### Skill створився, але agent його не використовує

Перевір:

- skill enabled;
- skill linked у Agent editor → Skills;
- agent enabled;
- review запускається саме цим agent-ом, а не іншим.

