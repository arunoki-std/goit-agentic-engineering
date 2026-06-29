# INSIGHTS.md — server/ (@devdigest/api)

Fastify 5 · Drizzle ORM · Postgres/pgvector · testcontainers

Entry format: `[YYYY-MM-DD] <finding> — <file:line if applicable>`
Rules: append-only; correct with a dated note, never overwrite; terse + actionable "cold".
Prune quarterly.

---

## What Works

<!-- Підходи й рішення, що спрацювали в server/ -->
[2026-06-25] Diversifying convention samples by bumping getConventionSamples n from 12→60 then round-robin across dirGroup() keys is essentially free — getTopFilesByRank already over-fetches Math.max(n*10, 100) rows internally (600 vs 120), so the cost is one larger DB read, not extra LLM calls — src/modules/repo-intel/service.ts:647

## What Doesn't Work

<!-- Глухі кути й антипатерни — найцінніша секція -->
<!-- Приклад: [2026-06-19] Не викликай adapter напряму в service — ламає mock у тестах; завжди через container.ts -->
[2026-06-29] PR з head_sha='demo' (seeded demo data) тихо повертає score=100 з 0 знахідок — diff-loader ловить git-помилку, переходить до diffFromPrFiles, не знаходить рядків у pr_files і повертає порожній UnifiedDiff; жодної помилки або попередження не емітується — server/src/modules/reviews/diff-loader.ts:19
[2026-06-29] GET /agents/:id/versions повертає [] для свіжого агента — snapshot версії 1 записується тільки при першому config-changing PUT; до цього конфіг версії 1 існує лише в рядку таблиці agents — server/src/db/schema/agents.ts
[2026-06-23] Fastify: реєстрація `/:id` перед статичними маршрутами (`/community`, `/parse-import`, `/import-url`) — статичні маршрути ніколи не спрацьовують (тихо відповідає `:id` handler з невалідним UUID); завжди реєструй static routes ПЕРШИМИ — src/modules/skills/routes.ts:1
[2026-06-24] `ContainerOverrides.llm` mock silently misses if its key doesn't match what the service passes to `container.llm(id)` — container does `this.overrides.llm?.[id]`, so injecting `{ openai: mock }` when the service calls `llm('openrouter')` skips the mock and hits the real network with no error — src/platform/container.ts:llm
[2026-06-24] `SkillsService.create()` hardcodes `source: 'manual'`; `importSkill()` overrides `enabled` to `false` for all non-manual sources — to persist a skill with `source='extracted'` and a caller-controlled `enabled`, bypass both and call `SkillsRepository.insert()` directly — src/modules/skills/service.ts
[2026-06-24] `STRUCTURAL_ONLY_RE \}[;,)]*` matches only bare `}`, `};`, `})` etc. — `];` (array closer) and `} catch (e) {` (block closer followed by word) both slip through; added `\][;,]*` for array closers, but do NOT add `} catch` universally — it is valid evidence for error-handling rules about catch blocks — src/modules/conventions/service.ts:STRUCTURAL_ONLY_RE
[2026-06-24] Even with explicit prompt guidance, GPT-4.1 cites `import type { Line } from "./helpers"` as evidence for a naming rule ("Interfaces are named in PascalCase") because the interface name appears in the import line — deterministic fix: reject lines starting with `import`/`export` for naming and typing categories in `isWeakEvidence` — src/modules/conventions/service.ts:isWeakEvidence
[2026-06-25] getConventionSamples(repoId, 12) with PageRank selects only infrastructure files in practice — import-hub files (src/platform/*, shared types) monopolize all 12 slots; feature module files (src/modules/*) never appear, causing systematic false negatives for service-layer conventions — src/modules/conventions/service.ts:319
[2026-06-24] LLM extraction prompts without an explicit confidence scale produce `confidence: 1` for every candidate — GPT-4.1 via OpenRouter returned 1.0 on all 17/17 candidates until a four-tier scale with anchor descriptions was added to the system prompt; without anchors the model treats 1.0 as the default numeric value — src/modules/conventions/service.ts:EXTRACTION_SYSTEM_PROMPT

## Codebase Patterns

<!-- Non-default конвенції server/ -->
<!-- Приклад: [2026-06-19] Всі секрети через SecretsProvider, не AppConfig — src/adapters/secrets/local.ts -->
[2026-06-22] Modules follow Sliced Onion Architecture — Onion rings live *inside* each modules/<name>/ slice, not as global layer folders; reorganizing into src/controllers/ or src/services/ would break this intentional pattern — src/modules/
[2026-06-24] Nested routes with two UUID params (e.g. `/repos/:id/conventions/:conventionId`) cannot reuse the shared `IdParams = z.object({ id: z.string().uuid() })`; define a separate params schema with both UUIDs — src/modules/conventions/routes.ts
[2026-06-24] Zod all-optional object (PATCH body) silently accepts `{}` as valid; use `.refine((b) => b.field1 !== undefined || b.field2 !== undefined)` to reject empty patches at the edge — src/modules/conventions/routes.ts
[2026-06-24] When a module's extraction pipeline needs one column from another module's table (e.g. conventions needing `repos.clone_path`), query `t.repos` directly inside the local repository instead of importing or injecting the foreign module's Repository class — keeps the service layer clean without adding a cross-module service dependency — src/modules/conventions/repository.ts:getRepoClonable
[2026-06-24] Counterpart to the above: when a module needs the *full behavior* of another module's repository including side effects (e.g. `SkillsRepository.insert()` which also snapshots a version row), import that Repository class directly into the local service rather than duplicating the logic — the threshold is whether you need one column (→ raw query) or the full mutation path (→ import the Repository) — src/modules/conventions/service.ts:createSkill

## Tool & Library Notes

<!-- Квірки Fastify 5, Drizzle, pgvector, testcontainers -->
[2026-06-22] Drizzle: the Onion layer boundary is `db/schema/*` imports, not the `db` client itself; `container.db` may be passed into a repository constructor, but only repository.ts may import table definitions — db/schema/
[2026-06-24] Zod v3: `z.number().default(0.6).transform(v => ...)` inside a `z.object()` makes `z.infer<>` emit `confidence?: number | undefined` (not `number`) — the error only surfaces when passing schema output to a typed function, not at definition; fix: declare field as `z.number().optional()` and apply default + clamping in consuming code — src/modules/conventions/service.ts

## Recurring Errors & Fixes

<!-- Повторювані помилки + фікс -->
<!-- Приклад: [2026-06-19] "relation does not exist" → міграції не були застосовані; cd server && pnpm db:migrate -->
[2026-06-23] `app.httpErrors.badRequest()` — `@fastify/sensible` не зареєстровано в цьому додатку; виклик падає зі "Property 'httpErrors' does not exist"; завжди кидай `new AppError(code, msg, statusCode)` з `platform/errors.ts` — src/modules/skills/routes.ts
[2026-06-24] `container.llm('openai')` → "OPENAI_API_KEY is not configured" at runtime in this deployment — only OPENROUTER_API_KEY is provisioned; use `container.llm('openrouter')` with model `openai/gpt-4.1` to reach OpenAI models via proxy — src/modules/conventions/service.ts

## Session Notes

<!-- Датовані підсумки сесій -->

[2026-06-19] A reviewed PR with 0 findings returns `null` for `findings_summary` unless the map is pre-seeded with zero counters before the findings query — fixes the "—" vs. dimmed-badges ambiguity — pulls/routes.ts:120

## Open Questions

<!-- Що лишилось нез'ясованим -->
