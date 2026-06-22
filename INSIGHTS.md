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

## Codebase Patterns

<!-- Non-default конвенції та архітектурні рішення цього проекту -->

## Tool & Library Notes

<!-- Квірки залежностей, версійні сюрпризи, нестандартна поведінка -->
[2026-06-22] Отримати один піддиректорій з GitHub без клонування всього репо: `git clone --depth=1 --filter=blob:none --sparse <url> /tmp/dir && cd /tmp/dir && git sparse-checkout set <subpath>`
[2026-06-22] skill-creator workspace (`<skill>-workspace/`) є sibling до skill dir і не згадується в SKILL.md — це development artifact eval-циклу, безпечно видаляти після завершення; Claude Code завантажує лише вміст самої skill dir

## Recurring Errors & Fixes

<!-- Повторювані помилки + конкретний фікс (щоб не повторювати) -->

## Session Notes

<!-- Датовані підсумки сесій — що зроблено, що відкрито -->

## Open Questions

<!-- Що лишилось нез'ясованим — питання без відповіді -->
