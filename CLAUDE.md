# DevDigest — agent map

→ Human docs: README.md

## Stack
Node ≥ 22 · pnpm ≥ 10 · Postgres 16 + pgvector (Docker) · TypeScript

## Packages (no monorepo workspace)
| Folder | Package | Port |
|--------|---------|------|
| server/ | @devdigest/api | 3001 |
| client/ | @devdigest/web | 3000 |
| reviewer-core/ | @devdigest/reviewer-core | — |
| e2e/ | @devdigest/e2e | — |
| server/src/vendor/shared | @devdigest/shared | — |

Cross-package links = tsconfig path aliases, NOT npm/pnpm links. Each package has its own lockfile.

## Start everything
```sh
./scripts/dev.sh   # Docker Postgres + migrate + seed + API + web
```

## Gotchas
- Migrations NOT applied on boot — always run `cd server && pnpm db:migrate` first
- @devdigest/shared source lives in server/src/vendor/shared — edit it there
- reviewer-core never compiles to JS; `build` = typecheck only
- Secrets go to ~/.devdigest/secrets.json (mode 0600), never .env or DB
- Each package's node_modules is independent — run `pnpm install` inside the package

## Session protocol

**Start of session:** Read LEARNINGS.md, then confirm with a one-sentence summary of the top 3 most relevant points before beginning work. This forces active processing, not passive load.

**End of session:** After work that involved a non-trivial problem, solution, or discovery (>30 min), append to the relevant section in the module's LEARNINGS.md. Do not skip — if you skip the wrap-up, the system doesn't learn.

**Rules for entries:**
- Format: `[YYYY-MM-DD] <finding> — <file:line>`
- Append-only: add new dated entries; correct with a dated note, never overwrite
- Test: "would this be obvious to anyone reading the code?" — if yes, don't write it
- Vague: "async can be tricky" → Useful: "Promise.all() times out after 30 items in the indexer — use Promise.allSettled() with batches of 10"
- Prune quarterly: stale entries are noise, not signal
