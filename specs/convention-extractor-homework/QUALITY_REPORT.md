# Convention Extractor — Quality Report

## What was bad

The original sampling strategy called `getConventionSamples(repoId, 12)`, which delegates to `getTopFilesByRank(repoId, 12)`. This returns the 12 highest-ranked files by PageRank (import-graph centrality).

**Problem**: PageRank rewards files that are imported by many others — infrastructure files like `src/platform/container.ts`, shared types, utility adapters. In practice, all 12 slots filled from 1-2 directories. Feature module files (`src/modules/reviews/service.ts`, `src/modules/agents/service.ts`) rank lower and never appeared in the LLM context.

**Observed false negatives on `devdigest/api`:**
- "Repository methods are always scoped to workspaceId first" — only visible in feature module repositories, never in platform files
- "Throw `NotFoundError` instead of generic `new Error()`" — the `NotFoundError` class is in `src/platform/errors.ts` (high rank), but its usage pattern is only in service files (low rank)
- "Services use early-return guards before business logic" — a service-layer pattern invisible when only infrastructure files are sampled

**Observed false negatives on a typical Next.js repo:**
- "Page components always wrap content in a Suspense boundary" — only visible in page files, which rank below hook/util files
- "Hooks never fetch data directly; they compose server actions" — pattern in feature hooks, not shared utility hooks

## What changed

Added directory-stratified sampling in `server/src/modules/conventions/service.ts`:

1. **Larger pool**: `getConventionSamples(repoId, 60)` fetches up to 60 candidates (still PageRank-ranked by repo-intel internally).
2. **`dirGroup(path)`**: Maps a file path to its directory group using at most 3 path segments, e.g. `src/modules/reviews/service.ts` → `src/modules/reviews`, `src/adapters/llm/x.ts` → `src/adapters/llm`.
3. **`diversifyPaths(paths, 12)`**: Round-robins across directory groups, picking the top-ranked file from each group first, then the second-ranked, etc. Falls back to straight rank order when all paths share one group.

The 40KB total context budget in `gatherSampleFiles` remains unchanged — it is the LLM context guard regardless of which 12 files are selected.

## How it affected quality

With stratified sampling, the LLM context now contains files from multiple distinct areas:

| Before | After |
|--------|-------|
| 10-12 files from `src/platform/` + `src/adapters/` | 1-2 files per directory group |
| LLM never sees `src/modules/*` | At least one file from each feature module |
| Conventions: heavy on "use Zod", "use Fastify" | Catches "workspace-scoped repos", "throw NotFoundError", "early-return guards" |

The improvement is structural: same prompt, same model, same evidence validation — only the diversity of input changes.

## Known limitations

- **Still 12 files sent to the LLM** — bounded by the 40KB total context budget and per-file 3KB cap.
- **PageRank within each group is still the ranking criterion** — if a directory has 10 files, only the top-ranked one is chosen per round; less-imported files within a directory are still missed.
- **Flat repos (< 2 distinct directory groups)** see no change: the fallback returns the original top-12 in rank order.
- **Temperature 0** means deterministic but potentially conservative output — the LLM won't speculate about patterns it's uncertain about.
- **No multi-pass extraction**: a single LLM call with 12 files. Repos with 50+ distinct conventions will always have gaps.
- **Re-scan replaces all candidates** — manually edited rules are lost on re-scan; no merge strategy.
