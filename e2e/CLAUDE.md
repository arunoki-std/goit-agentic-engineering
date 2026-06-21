# e2e/ — agent map (@devdigest/e2e)

→ Human docs: README.md

## Commands
```sh
./scripts/e2e.sh  # hermetic: isolated Postgres :5433 · API :3101 · web :3100 (recommended)
npm test          # against already-running stack (needs freshly-seeded DB)
```

## How flows work
- Specs: `specs/NN-name.flow.json` — JSON steps passed to agent-browser CLI
- `{BASE}` replaced with `E2E_BASE_URL` at runtime
- Assertions = `wait --text` / `wait --url` — timeout = non-zero exit = fail
- Optional `"assert": { "stdoutIncludes": "…" }` for stdout checks

## Non-default conventions
- agent-browser CLI, NOT Playwright
- No LLM calls, no API keys — all flows run against static seeded data
- AI `chat` command is never used (keeps flows deterministic and key-free)
- Locators: `--url`, `--text`, `find role|text|label` only

## Do-not-touch
- **NEVER run `docker compose down -v`** — destroys `devdigest_pgdata` volume (all dev data)
- Flows 02/04/05 assume seeded repo is the ONLY repo — always use hermetic runner locally

## Gotchas
- Hermetic runner is safe to run alongside the normal dev stack (alternate ports, no shared volume)
- Failure screenshots → `e2e/test-results/` (git-ignored; uploaded as CI artifact)
- CI guarantees a freshly-seeded DB; local dev DB usually has extra repos that break flows 02/04/05

## Session protocol

**Start of session:** Read INSIGHTS.md, then confirm with a one-sentence summary of the top 3 most relevant points before beginning work.

**End of session:** After work that involved a non-trivial problem, solution, or discovery, append to the relevant section in e2e/INSIGHTS.md. Do not skip.

**Entry format:** `[YYYY-MM-DD] <finding> — <file:line>`
**Anti-banality test:** "would this be obvious to anyone reading the code?" — if yes, don't write it.
Append-only; correct with a dated note, never overwrite. Prune quarterly.
