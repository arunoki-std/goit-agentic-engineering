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

## Writing insights
After completing non-trivial work in this project, add findings to insights/INSIGHTS.md.

**Add:**
- Unexpected behaviors or hidden constraints discovered
- Non-obvious patterns or conventions that differ from defaults
- Decisions made with the reasoning behind them
- Gotchas that cost time to debug

**Do NOT add:**
- Things obvious from reading the code
- Standard language/framework practices
- In-progress or volatile state
- File-by-file descriptions
