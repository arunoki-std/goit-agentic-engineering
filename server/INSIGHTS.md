# INSIGHTS.md — server/ (@devdigest/api)

Fastify 5 · Drizzle ORM · Postgres/pgvector · testcontainers

Entry format: `[YYYY-MM-DD] <finding> — <file:line if applicable>`
Rules: append-only; correct with a dated note, never overwrite; terse + actionable "cold".
Prune quarterly.

---

## What Works

<!-- Підходи й рішення, що спрацювали в server/ -->

## What Doesn't Work

<!-- Глухі кути й антипатерни — найцінніша секція -->
<!-- Приклад: [2026-06-19] Не викликай adapter напряму в service — ламає mock у тестах; завжди через container.ts -->

## Codebase Patterns

<!-- Non-default конвенції server/ -->
<!-- Приклад: [2026-06-19] Всі секрети через SecretsProvider, не AppConfig — src/adapters/secrets/local.ts -->

## Tool & Library Notes

<!-- Квірки Fastify 5, Drizzle, pgvector, testcontainers -->

## Recurring Errors & Fixes

<!-- Повторювані помилки + фікс -->
<!-- Приклад: [2026-06-19] "relation does not exist" → міграції не були застосовані; cd server && pnpm db:migrate -->

## Session Notes

<!-- Датовані підсумки сесій -->

[2026-06-19] A reviewed PR with 0 findings returns `null` for `findings_summary` unless the map is pre-seeded with zero counters before the findings query — fixes the "—" vs. dimmed-badges ambiguity — pulls/routes.ts:120

## Open Questions

<!-- Що лишилось нез'ясованим -->
