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
[2026-06-23] Fastify: реєстрація `/:id` перед статичними маршрутами (`/community`, `/parse-import`, `/import-url`) — статичні маршрути ніколи не спрацьовують (тихо відповідає `:id` handler з невалідним UUID); завжди реєструй static routes ПЕРШИМИ — src/modules/skills/routes.ts:1

## Codebase Patterns

<!-- Non-default конвенції server/ -->
<!-- Приклад: [2026-06-19] Всі секрети через SecretsProvider, не AppConfig — src/adapters/secrets/local.ts -->
[2026-06-22] Modules follow Sliced Onion Architecture — Onion rings live *inside* each modules/<name>/ slice, not as global layer folders; reorganizing into src/controllers/ or src/services/ would break this intentional pattern — src/modules/
[2026-06-24] Nested routes with two UUID params (e.g. `/repos/:id/conventions/:conventionId`) cannot reuse the shared `IdParams = z.object({ id: z.string().uuid() })`; define a separate params schema with both UUIDs — src/modules/conventions/routes.ts
[2026-06-24] Zod all-optional object (PATCH body) silently accepts `{}` as valid; use `.refine((b) => b.field1 !== undefined || b.field2 !== undefined)` to reject empty patches at the edge — src/modules/conventions/routes.ts

## Tool & Library Notes

<!-- Квірки Fastify 5, Drizzle, pgvector, testcontainers -->
[2026-06-22] Drizzle: the Onion layer boundary is `db/schema/*` imports, not the `db` client itself; `container.db` may be passed into a repository constructor, but only repository.ts may import table definitions — db/schema/

## Recurring Errors & Fixes

<!-- Повторювані помилки + фікс -->
<!-- Приклад: [2026-06-19] "relation does not exist" → міграції не були застосовані; cd server && pnpm db:migrate -->
[2026-06-23] `app.httpErrors.badRequest()` — `@fastify/sensible` не зареєстровано в цьому додатку; виклик падає зі "Property 'httpErrors' does not exist"; завжди кидай `new AppError(code, msg, statusCode)` з `platform/errors.ts` — src/modules/skills/routes.ts

## Session Notes

<!-- Датовані підсумки сесій -->

[2026-06-19] A reviewed PR with 0 findings returns `null` for `findings_summary` unless the map is pre-seeded with zero counters before the findings query — fixes the "—" vs. dimmed-badges ambiguity — pulls/routes.ts:120

## Open Questions

<!-- Що лишилось нез'ясованим -->
