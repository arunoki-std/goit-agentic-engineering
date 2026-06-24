# HW2 Pull Request — Conventions Extractor + API Contract Reviewer

## Summary

Implements the full Conventions Extractor feature and demonstrates the API Contract Reviewer experiment (with skill vs without skill).

### What was built

- **Backend**: `POST /repos/:id/conventions/extract` — samples repo config files + top-12 source files, calls LLM with evidence-first prompt, runs deterministic evidence validation (file exists, line number valid, snippet non-empty, no semantically-weak evidence), persists only validated candidates. Re-scan replaces all previous candidates.
- **Backend**: `GET /repos/:id/conventions` — workspace-scoped list of candidates.
- **Backend**: `PATCH /repos/:id/conventions/:id` — accept/reject/edit rule.
- **Backend**: `POST /repos/:id/conventions/skill-preview` + `POST /repos/:id/conventions/skill` — builds a Markdown skill body from accepted candidates, optionally links to an agent.
- **Client**: `/repos/[repoId]/conventions` page — Scan/Re-scan, candidate cards with accept/reject/edit, evidence links, bulk state counter, Create skill modal, Link to agent select.
- **Demo fixtures**: `api-contract-reviewer-skill.md` + `demo-payments-api.ts` + `DEMO.md` for the acceptance experiment.

---

## How to verify

1. Run `./scripts/dev.sh` (Docker Postgres + API + web).
2. Add a repo (or use the seeded `acme/payments-api`), trigger indexing so `clonePath` is set.
3. Navigate to **Conventions** in the repo nav → click **Scan** → candidates appear.
4. Accept 3, reject 1 → Create skill → confirm rejected candidate absent from body.
5. Follow `specs/convention-extractor-homework/DEMO.md` for the agent experiment.

---

## Extractor quality report

Tested on `goit-agentic-engineering` (TypeScript/Node monorepo):

| Metric | Result |
|--------|--------|
| Total candidates after validation | ~10–15 per scan |
| Candidates with blank/weak evidence (rejected by validator) | ~20–30% |
| Candidates with clear rule + matching evidence | ~60–70% |
| Confidence distribution | mostly 0.6–0.85; rarely 1.0 |

**Good finds (examples)**:
- Naming: `PascalCase` interfaces with evidence on a concrete `interface` declaration line
- Typing: explicit return types on async functions (`Promise<T>`) with evidence on the function signature
- Imports: `import type` used for type-only imports with evidence on the import line

**Known weaknesses**:
- LLM sometimes cites a line that is semantically near but not exact (e.g. the line above a declaration). Deterministic weak-evidence filter catches most of these.
- Confidence calibration is better for config-backed rules (e.g. `"semi": true` in ESLint config → 0.95) than for stylistic patterns seen in one file (→ 0.6–0.7).
- Extractor misses runtime conventions (e.g. "always use `AbortSignal`") because they are patterns in logic, not in declarations.

---

## API Contract Reviewer experiment

| Scenario | Result |
|----------|--------|
| Agent WITHOUT skill, demo PR with 4 breaking changes | 0 CRITICAL findings; agent says "naming convention refactor" |
| Agent WITH `api-contract-reviewer-skill` linked | 3–4 CRITICAL findings: missing alias for renamed fields, deleted `account_number`, status code change |

The skill body explicitly defines severity levels (CRITICAL vs WARNING) and evidence patterns, which makes the model's findings consistent and specific rather than probabilistic.

---

## Known limitations

- Extractor only looks at files that `repoIntel.getConventionSamples()` returns (top-12 by rank). Files outside this set are not sampled.
- Re-scan deletes all previous candidates, including manually edited rules. There is no merge strategy for re-scans.
- Skill body token count is estimated at creation time; it is not updated if the skill body is later edited.
- The API Contract Reviewer agent behaviour without skill is non-deterministic — the model may occasionally flag breaking changes even without the skill. The skill makes findings *consistent and specific*, not merely possible.

---

## Demo video

`[link to be added]`

See `specs/convention-extractor-homework/DEMO.md` for the full step-by-step script.
