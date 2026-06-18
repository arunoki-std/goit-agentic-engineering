# server/ — agent map (@devdigest/api)

→ Human docs: README.md | Contracts: src/vendor/shared/

## Commands
```sh
pnpm dev          # API on :3001
pnpm db:migrate   # REQUIRED before first run — not auto-applied on boot
pnpm db:seed      # idempotent demo data (acme/payments-api, PR #482, 2 agents)
pnpm test         # unit + integration
pnpm typecheck
```

## Where things live
```
src/modules/<name>/   feature plugins — routes · service · repository
src/platform/         DI container · SSE bus · model router · run logger
src/adapters/         ports: llm · github · git · astgrep · secrets · embedder
src/db/schema/        Drizzle schema (ALL course-lesson tables present, unused ones empty)
src/vendor/shared/    @devdigest/shared Zod contracts (source of truth)
server/clones/        git-cloned repos (git-ignored)
```

## Non-default conventions
- All adapters injected via `src/platform/container.ts` — never import adapters directly in services
- Route schemas are Zod via `fastify-type-provider-zod` — one definition = validation + serialization
- Test split: `*.it.test.ts` = DB-backed (testcontainers Postgres); everything else = hermetic, no Docker
- Secrets go through `SecretsProvider` (`src/adapters/secrets/local.ts`), not `AppConfig`

## Gotchas
- DB schema has ALL course tables upfront — unused ones sit empty until lessons fill them
- `REPO_INTEL_ENABLED=true` by default; degrades silently when repo is not yet indexed
- Grounding gate is mandatory — score recomputed from survived findings, model's self-reported score ignored
- `RunLogger` fans out to multiple runIds for shared pre-work (diff/intent) before per-agent loop
- `GITHUB_TOKEN` canonical, `GITHUB_PAT` accepted as fallback
- Rate limiting: global 120/min; SSE and `/health*` are exempt; tighter caps on review endpoints

## Do-not-touch
- `src/platform/grounding.ts` is a re-export shim — real logic lives in reviewer-core
- DB migrations in `src/db/migrations/` — never edit applied migrations

## Writing insights
After completing non-trivial work, add findings to insights/INSIGHTS.md.

**Add:** unexpected behaviors, hidden constraints, non-obvious patterns, decisions with reasoning, gotchas discovered.
**Do NOT add:** things obvious from code, standard practices, volatile/in-progress state.
