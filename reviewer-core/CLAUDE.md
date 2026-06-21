# reviewer-core/ — agent map (@devdigest/reviewer-core)

→ Human docs: README.md

## Commands
```sh
pnpm test         # hermetic vitest — no keys, no network
pnpm build        # type-check only — NO JS output produced
```

## Core contract: pure engine
- NO database, NO GitHub, NO filesystem access
- LLMProvider is INJECTED by the caller — never imported inside this package
- Consumed via tsconfig path alias (`@devdigest/reviewer-core` → `../reviewer-core/src`)
- Never published as npm package; consumed as TypeScript source directly

## Where things live
```
src/review/run.ts       engine entry: diff → prompt → LLM → grounded Review
src/prompt.ts           assemblePrompt() + wrapUntrusted() + INJECTION_GUARD
src/grounding.ts        mandatory citation gate — drops findings with hallucinated lines
src/llm/structured.ts   Zod → JSON Schema + parse-with-repair
src/llm/openrouter.ts   OpenRouter provider (used by CI runner, L06+)
src/output/to-review.ts grounded Review → GitHub PR payload (CI, L06+)
src/index.ts            public API barrel
```

## Non-default conventions
- Strategy `auto` → map-reduce only when diff is BOTH large (>400 lines) AND multi-file
- Score recomputed deterministically from survived findings — model's self-reported score discarded
- `INJECTION_GUARD` is appended to every system prompt by `assemblePrompt` — do not remove or duplicate it

## Gotchas
- Extra prompt slots (skills, memory, specs, callers, repoMap) are no-ops until course lessons wire them in
- `build` is a type-check, not a compile — there is no `dist/`
- Map-reduce: findings are merged with `reduceReviews()` before grounding, not after

## Session protocol

**Start of session:** Read INSIGHTS.md, then confirm with a one-sentence summary of the top 3 most relevant points before beginning work.

**End of session:** After work that involved a non-trivial problem, solution, or discovery, append to the relevant section in reviewer-core/INSIGHTS.md. Do not skip.

**Entry format:** `[YYYY-MM-DD] <finding> — <file:line>`
**Anti-banality test:** "would this be obvious to anyone reading the code?" — if yes, don't write it.
Append-only; correct with a dated note, never overwrite. Prune quarterly.
