# INSIGHTS.md — e2e/ (@devdigest/e2e)

agent-browser CLI · deterministic flows · no LLM · hermetic runner

Entry format: `[YYYY-MM-DD] <finding> — <file:line if applicable>`
Rules: append-only; correct with a dated note, never overwrite; terse + actionable "cold".
Prune quarterly.

---

## What Works

<!-- Підходи й рішення, що спрацювали в e2e/ -->

## What Doesn't Work

<!-- Глухі кути й антипатерни — найцінніша секція -->
<!-- Приклад: [2026-06-19] Запускати npm test проти dev DB з кількома репо — flows 02/04/05 падають на неправильному репо -->

## Codebase Patterns

<!-- Non-default конвенції e2e/ -->
<!-- Приклад: [2026-06-19] Локатори тільки --url/--text/find role|text|label — ніколи AI chat (ламає детермінізм) -->

## Tool & Library Notes

<!-- Квірки agent-browser CLI, hermetic runner -->

## Recurring Errors & Fixes

<!-- Повторювані помилки + фікс -->
<!-- Приклад: [2026-06-19] НІКОЛИ docker compose down -v — знищує devdigest_pgdata з усіма dev-даними -->

## Session Notes

<!-- Датовані підсумки сесій -->

## Open Questions

<!-- Що лишилось нез'ясованим -->
