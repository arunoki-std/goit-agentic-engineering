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

## Codebase Patterns

<!-- Non-default конвенції та архітектурні рішення цього проекту -->

## Tool & Library Notes

<!-- Квірки залежностей, версійні сюрпризи, нестандартна поведінка -->
[2026-06-22] Отримати один піддиректорій з GitHub без клонування всього репо: `git clone --depth=1 --filter=blob:none --sparse <url> /tmp/dir && cd /tmp/dir && git sparse-checkout set <subpath>`
[2026-06-22] skill-creator workspace (`<skill>-workspace/`) є sibling до skill dir і не згадується в SKILL.md — це development artifact eval-циклу, безпечно видаляти після завершення; Claude Code завантажує лише вміст самої skill dir

## Recurring Errors & Fixes

<!-- Повторювані помилки + конкретний фікс (щоб не повторювати) -->
[2026-06-22] skill-creator `run_loop.py` requires Python ≥ 3.10 — `str | None` union syntax in improve_description.py:20 throws `TypeError: unsupported operand type(s) for |` on macOS system Python 3.9.6; fix: `brew install python@3.12` and use `python3.12 -m scripts.run_loop` — skill-creator/scripts/improve_description.py:20
[2026-06-22] skill-creator docs use `python -m scripts.*` but macOS ships only `python3`; always use `python3.12 -m scripts.*` (not `python3` alone — that resolves to 3.9 on stock macOS) — skill-creator/scripts/

## Session Notes

<!-- Датовані підсумки сесій — що зроблено, що відкрито -->

## Open Questions

<!-- Що лишилось нез'ясованим — питання без відповіді -->
