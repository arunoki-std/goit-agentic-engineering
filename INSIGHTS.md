# INSIGHTS.md — project-level

Cross-cutting findings that affect multiple modules simultaneously.
Module-specific learnings live in each module's own INSIGHTS.md.

Entry format: `[YYYY-MM-DD] <finding> — <file:line if applicable>`
Rules: append-only; correct with a dated note, never overwrite; terse + actionable "cold".
Prune quarterly (stale entries are noise, not signal).

---

## What Works

<!-- Підходи й рішення, що спрацювали -->
[2026-06-22] Multi-tool agent instructions: put content in AGENTS.md, keep CLAUDE.md as a one-liner `@AGENTS.md` — Claude imports it transparently, Codex/Cursor/Gemini read AGENTS.md directly; one file to maintain across all 5 packages
[2026-06-22] anthropics/skills README suggests `/plugin marketplace` install, but copying skill folder directly to `.claude/skills/` works without plugin system — used to install skill-creator
[2026-06-24] Skills are injected BEFORE the diff in the review prompt (## Skills / rules → ## Diff to review order in assemblePrompt) — model reads explicit rules before it reads the code, which is why a linked skill makes findings consistent and specific rather than probabilistic — reviewer-core/src/prompt.ts:109

[2026-06-30] `worktree.baseRef: "head"` у `.claude/settings.json` змушує Implementer стартувати від HEAD поточної гілки замість main — усуває потребу в git diff/patch/apply workflow між worktree і feature branch (виправляє workaround з запису [2026-06-29] у Tool & Library Notes) — .claude/settings.json:2

## What Doesn't Work
[2026-06-29] Implementer агент невиправданий для малих адитивних змін (≤5 файлів, ≤10 нових рядків) — Wave 1 contract edits коштував 72k токенів; orchestrator робить те саме через Edit-виклики за ~500 токенів; Implementer виправданий тільки для складної логіки з тестами або коли треба паралельний disjoint scope

<!-- Глухі кути й антипатерни — найцінніша секція, заповнюй першою -->
[2026-06-22] Renaming CLAUDE.md → AGENTS.md silently breaks Claude Code — it reads only CLAUDE.md, not AGENTS.md; no warning is given
[2026-06-22] When creating a new skill, Claude bypassed `skill-creator` and wrote SKILL.md by hand — `skill-creator` should run first: it generates eval cases and measures trigger quality in the description; writing manually skips that feedback loop — .claude/skills/
[2026-06-23] skill-creator `aggregate_benchmark.py` silently produces empty benchmark.json (delta: +0.00, all zeros) when grading.json sits directly in `with_skill/` — script uses `glob("run-*")` and expects `with_skill/run-1/grading.json`; no error or warning is printed — .claude/skills/skill-creator/scripts/aggregate_benchmark.py:106

## Codebase Patterns

<!-- Non-default конвенції та архітектурні рішення цього проекту -->
[2026-06-29] plan-verifier agent needs explicit "do NOT comment on quality/style" prohibition in its system prompt — without it, the agent naturally drifts into code review mode and never produces the traceability matrix; this is the #1 failure mode for requirement-tracing agents per 2024-2025 LLM research — .claude/agents/plan-verifier.md
[2026-06-29] `server/src/vendor/shared/` і `client/src/vendor/shared/` НЕ linked через npm/pnpm — будь-яка зміна Zod-контракту (Intent, PromptAssembly тощо) мусить бути вручну продубльована в обидва шляхи; client компілюється проти власної копії і не дає помилки при розсинхроні — server/src/vendor/shared/contracts/ + client/src/vendor/shared/contracts/
[2026-06-29] Уточнення: reviewer-core читає @devdigest/shared безпосередньо з server/src/vendor/shared/ через tsconfig path alias (не має власної копії) — при змінах контрактів є рівно ДВА targets для sync (server = source, client = mirror), не три — reviewer-core/tsconfig.json

## Tool & Library Notes

<!-- Квірки залежностей, версійні сюрпризи, нестандартна поведінка -->
[2026-06-22] Отримати один піддиректорій з GitHub без клонування всього репо: `git clone --depth=1 --filter=blob:none --sparse <url> /tmp/dir && cd /tmp/dir && git sparse-checkout set <subpath>`
[2026-06-29] Implementer worktree завжди базується на main, а не на поточній feature branch — при роботі на feature branch (напр. lab-3) НЕ мерджи worktree branch; натомість: `git diff` у worktree → зберегти patch → `git apply` у робочому дереві — .claude/worktrees/
[2026-06-29] Implementer що повертає BLOCKED через відсутній upstream-контракт (напр. Wave 1 не в worktree) може мати повністю коректну логіку — тести часто проходять, а typecheck падає лише через відсутній тип; застосуй diff на feature branch разом з Wave 1 змінами і typecheck відновиться без повторного запуску агента
[2026-06-29] `git apply` патч з worktree для INSIGHTS.md падає з "patch does not apply" коли INSIGHTS.md вже модифіковано на feature branch під час планування — виключай INSIGHTS.md з `git diff` і переноси записи вручну через Edit
[2026-06-29] Для фінальної integration wave (яка залежить від усіх попередніх хвиль) запускай Implementer БЕЗ worktree isolation щоб агент бачив вже змерджені зміни; у промпті явно вказати "work directly in the project files on <branch>"
[2026-06-29] Якщо Implementer backportує попередні хвилі у власний worktree (щоб пройти typecheck), `git diff` покаже ці backport-файли разом з реальними змінами — застосовуй `git apply` вибірково тільки для файлів цієї хвилі; backport-копії вже є на feature branch і будуть перезаписані якщо застосувати весь diff
[2026-06-22] skill-creator workspace (`<skill>-workspace/`) є sibling до skill dir і не згадується в SKILL.md — це development artifact eval-циклу, безпечно видаляти після завершення; Claude Code завантажує лише вміст самої skill dir

## Recurring Errors & Fixes

<!-- Повторювані помилки + конкретний фікс (щоб не повторювати) -->
[2026-06-23] `git add client/src/app/agents/[id]/page.tsx` падає в zsh з "no matches found" — `[id]`/`[repoId]` у Next.js dynamic-route директоріях zsh розпізнає як glob character class; фікс: цитувати шлях у лапках і запускати з `cd <repo>` (не `git -C`): `cd repo && git add "client/src/app/agents/[id]/page.tsx"`
[2026-06-23] bash `[ -f "path/[id]/file.tsx" ]` SILENTLY повертає false для Next.js App Router шляхів — bash інтерпретує `[id]` як character class і не знаходить файл (на відміну від zsh, який дає помилку); в pr-self-review це дало false "MISSING TEST" для покритих файлів; фікс: використовувати `find "path/[id]/" -name "file.tsx"` або `compgen -G` замість `[ -f ]`
[2026-06-22] skill-creator `run_loop.py` requires Python ≥ 3.10 — `str | None` union syntax in improve_description.py:20 throws `TypeError: unsupported operand type(s) for |` on macOS system Python 3.9.6; fix: `brew install python@3.12` and use `python3.12 -m scripts.run_loop` — skill-creator/scripts/improve_description.py:20
[2026-06-22] skill-creator docs use `python -m scripts.*` but macOS ships only `python3`; always use `python3.12 -m scripts.*` (not `python3` alone — that resolves to 3.9 on stock macOS) — skill-creator/scripts/
[2026-06-23] `eval-viewer/generate_review.py` also requires Python ≥ 3.10 (`dict | None` syntax at line 85) — not in scripts/, so use `python3.12 eval-viewer/generate_review.py <workspace>` directly (not the -m form) — .claude/skills/skill-creator/eval-viewer/generate_review.py:85
[2026-06-24] Demo PRs that MODIFY existing files only expose changed lines to the citation-grounding gate; a breaking change on an unchanged line is dropped as hallucinated — use NEW fixture files (pure additions) so every line is in a diff hunk and remains groundable — reviewer-core/src/grounding.ts:24

## Session Notes

<!-- Датовані підсумки сесій — що зроблено, що відкрито -->
[2026-06-23] Implemented full Skills feature (server CRUD + client UI): static routes in Fastify MUST be registered before `:id` wildcards or community/parse-import/import-url routes will shadow to `:id` handler — `routes.ts` registers them first — server/src/modules/skills/routes.ts:1
[2026-06-23] `FormField` from @devdigest/ui accepts `hint` but NOT `style` — wrap in `<div style={…}>` for margin; `TextInput` does NOT accept `hint` — put hint on the wrapping `FormField` instead — client/src/vendor/ui/kit/FormField.tsx
[2026-06-23] Drawer component's children area already applies `padding: 24` — use `margin: "-24px"` on a child wrapper to break full-width elements (tab bars) out of that padding — client/src/vendor/ui/kit/Drawer.tsx:57
[2026-06-23] Array destructuring swap `[a, b] = [b, a]` triggers TS "possibly undefined" with noUncheckedIndexedAccess; use temp var: `const tmp = arr[i]!; arr[i] = arr[j]!; arr[j] = tmp;` — client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/SkillsTab.tsx

## Open Questions

<!-- Що лишилось нез'ясованим — питання без відповіді -->

## Conventions Extractor

[2026-06-24] `z.number().transform(v => Math.min(1, Math.max(0, v)))` lets `MockLLMProvider.completeStructured` accept out-of-range confidence (e.g. 1.5) via `safeParse` — the transform runs before the result is returned, so the test receives the clamped value without throwing — server/src/modules/conventions/service.ts:31
[2026-06-24] Evidence validation reads actual files from `clonePath` with `node:fs/promises readFile`; IT tests write real files into `os.tmpdir()` via `mkdtemp` and set `clonePath` on the DB row — no fs mocking needed — server/test/conventions-extract.it.test.ts
[2026-06-24] Re-scan policy: `replaceAll` deletes all existing candidates for `(workspaceId, repoId)` then inserts new ones in one shot — simple, no accumulation, createdAt on new rows serves as scan timestamp — server/src/modules/conventions/repository.ts
[2026-06-24] Conventions → skill → agent flow: backend `POST /repos/:id/conventions/skill` already accepted `agent_id` and called `agentsService.linkSkill`; only the client modal was missing the select — `CreateConventionSkillInput` in `hooks/conventions.ts` already had `agent_id?: string`; adding `useAgents()` + SelectInput completed the wiring without touching the review engine — client/src/app/repos/[repoId]/conventions/_components/CreateSkillModal/CreateSkillModal.tsx
