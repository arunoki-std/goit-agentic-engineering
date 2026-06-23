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

## What Doesn't Work

<!-- Глухі кути й антипатерни — найцінніша секція, заповнюй першою -->
[2026-06-22] Renaming CLAUDE.md → AGENTS.md silently breaks Claude Code — it reads only CLAUDE.md, not AGENTS.md; no warning is given
[2026-06-22] When creating a new skill, Claude bypassed `skill-creator` and wrote SKILL.md by hand — `skill-creator` should run first: it generates eval cases and measures trigger quality in the description; writing manually skips that feedback loop — .claude/skills/
[2026-06-23] skill-creator `aggregate_benchmark.py` silently produces empty benchmark.json (delta: +0.00, all zeros) when grading.json sits directly in `with_skill/` — script uses `glob("run-*")` and expects `with_skill/run-1/grading.json`; no error or warning is printed — .claude/skills/skill-creator/scripts/aggregate_benchmark.py:106

## Codebase Patterns

<!-- Non-default конвенції та архітектурні рішення цього проекту -->

## Tool & Library Notes

<!-- Квірки залежностей, версійні сюрпризи, нестандартна поведінка -->
[2026-06-22] Отримати один піддиректорій з GitHub без клонування всього репо: `git clone --depth=1 --filter=blob:none --sparse <url> /tmp/dir && cd /tmp/dir && git sparse-checkout set <subpath>`
[2026-06-22] skill-creator workspace (`<skill>-workspace/`) є sibling до skill dir і не згадується в SKILL.md — це development artifact eval-циклу, безпечно видаляти після завершення; Claude Code завантажує лише вміст самої skill dir

## Recurring Errors & Fixes

<!-- Повторювані помилки + конкретний фікс (щоб не повторювати) -->
[2026-06-23] `git add client/src/app/agents/[id]/page.tsx` падає в zsh з "no matches found" — `[id]`/`[repoId]` у Next.js dynamic-route директоріях zsh розпізнає як glob character class; фікс: цитувати шлях у лапках і запускати з `cd <repo>` (не `git -C`): `cd repo && git add "client/src/app/agents/[id]/page.tsx"`
[2026-06-23] bash `[ -f "path/[id]/file.tsx" ]` SILENTLY повертає false для Next.js App Router шляхів — bash інтерпретує `[id]` як character class і не знаходить файл (на відміну від zsh, який дає помилку); в pr-self-review це дало false "MISSING TEST" для покритих файлів; фікс: використовувати `find "path/[id]/" -name "file.tsx"` або `compgen -G` замість `[ -f ]`
[2026-06-22] skill-creator `run_loop.py` requires Python ≥ 3.10 — `str | None` union syntax in improve_description.py:20 throws `TypeError: unsupported operand type(s) for |` on macOS system Python 3.9.6; fix: `brew install python@3.12` and use `python3.12 -m scripts.run_loop` — skill-creator/scripts/improve_description.py:20
[2026-06-22] skill-creator docs use `python -m scripts.*` but macOS ships only `python3`; always use `python3.12 -m scripts.*` (not `python3` alone — that resolves to 3.9 on stock macOS) — skill-creator/scripts/
[2026-06-23] `eval-viewer/generate_review.py` also requires Python ≥ 3.10 (`dict | None` syntax at line 85) — not in scripts/, so use `python3.12 eval-viewer/generate_review.py <workspace>` directly (not the -m form) — .claude/skills/skill-creator/eval-viewer/generate_review.py:85

## Session Notes

<!-- Датовані підсумки сесій — що зроблено, що відкрито -->
[2026-06-23] Implemented full Skills feature (server CRUD + client UI): static routes in Fastify MUST be registered before `:id` wildcards or community/parse-import/import-url routes will shadow to `:id` handler — `routes.ts` registers them first — server/src/modules/skills/routes.ts:1
[2026-06-23] `FormField` from @devdigest/ui accepts `hint` but NOT `style` — wrap in `<div style={…}>` for margin; `TextInput` does NOT accept `hint` — put hint on the wrapping `FormField` instead — client/src/vendor/ui/kit/FormField.tsx
[2026-06-23] Drawer component's children area already applies `padding: 24` — use `margin: "-24px"` on a child wrapper to break full-width elements (tab bars) out of that padding — client/src/vendor/ui/kit/Drawer.tsx:57
[2026-06-23] Array destructuring swap `[a, b] = [b, a]` triggers TS "possibly undefined" with noUncheckedIndexedAccess; use temp var: `const tmp = arr[i]!; arr[i] = arr[j]!; arr[j] = tmp;` — client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/SkillsTab.tsx

## Open Questions

<!-- Що лишилось нез'ясованим — питання без відповіді -->
