# PR Self-Review Gate — branch `lab-2` vs `main`

**Reviewed:** 2026-06-23  
**Branch:** `lab-2`  
**Default branch:** `main`  
**Diff size:** 61 files changed, 12,138 insertions(+), 695 deletions(-)  
**Client source (client/src/) changes:** 21 files, 793 insertions(+), 471 deletions(−) = **1,264 lines**

---

## Step 1 — Changed Files Summary

### Frontend (client/)
- `client/src/app/agents/[id]/_components/AgentEditorPage/AgentEditorPage.tsx` — NEW (extracted from page)
- `client/src/app/agents/[id]/_components/AgentEditorPage/index.ts` — NEW
- `client/src/app/agents/[id]/_components/AgentEditorPage/styles.ts` — NEW
- `client/src/app/agents/[id]/page.tsx` — MODIFIED (now thin wrapper)
- `client/src/app/agents/_components/AgentCard/AgentCard.tsx` — MODIFIED (ConfirmModal replacing window.confirm)
- `client/src/app/onboarding/page.tsx` — MODIFIED (removed errant `"use client"`)
- `client/src/app/repos/[repoId]/pulls/[number]/_components/PRDetailView/PRDetailView.tsx` — NEW (extracted from page)
- `client/src/app/repos/[repoId]/pulls/[number]/_components/PRDetailView/index.ts` — NEW
- `client/src/app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx` — MODIFIED (ConfirmModal)
- `client/src/app/repos/[repoId]/pulls/[number]/page.tsx` — MODIFIED (now thin wrapper)
- `client/src/app/repos/[repoId]/pulls/_components/FilterBar/FilterBar.test.tsx` — NEW (test)
- `client/src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.test.tsx` — NEW (test)
- `client/src/app/repos/[repoId]/pulls/_components/PullsListView/PullsListView.tsx` — NEW (extracted from page)
- `client/src/app/repos/[repoId]/pulls/_components/PullsListView/index.ts` — NEW
- `client/src/app/repos/[repoId]/pulls/page.tsx` — MODIFIED (now thin wrapper)
- `client/src/components/app-shell/AppShell.tsx` — MODIFIED (ConfirmModal integration)
- `client/src/components/app-shell/hooks/index.ts` — MODIFIED
- `client/src/components/app-shell/hooks/useShellContext.ts` — MODIFIED (useConfirmRemoveRepo extracted)
- `client/src/components/confirm-modal/ConfirmModal.tsx` — NEW
- `client/src/components/confirm-modal/ConfirmModal.test.tsx` — NEW (test)
- `client/src/components/confirm-modal/index.ts` — NEW

### Backend (server/src/)
No `server/src/` files changed. Backend architecture review skipped.

### Other
- `.claude/skills/` — New skills added (onion-architecture, react-best-practices, skill-creator)
- `AGENTS.md`, `CLAUDE.md`, `INSIGHTS.md` — Documentation updates
- `docs/sessions/` — Session transcripts
- `e2e/`, `reviewer-core/`, `server/` docs — AGENTS/CLAUDE file updates

---

## Step 2 — Architecture Review (Frontend)

### Anti-pattern check results

**fetch() / axios() directly in component body or useEffect:**
- No direct `fetch()` calls found in component bodies. All data fetching goes through TanStack Query hooks (`useAgents`, `useAgent`, `usePulls`, `usePullDetail`, etc.) in `src/lib/hooks/`. ✅

**Business logic or API calls in page.tsx:**
- `client/src/app/agents/[id]/page.tsx` — Now a 5-line thin wrapper delegating to `AgentEditorPage`. ✅
- `client/src/app/repos/[repoId]/pulls/[number]/page.tsx` — Now a 5-line thin wrapper delegating to `PRDetailView`. ✅
- `client/src/app/repos/[repoId]/pulls/page.tsx` — Now a 5-line thin wrapper delegating to `PullsListView`. ✅
- `client/src/app/onboarding/page.tsx` — Removed errant `"use client"`, remains a thin wrapper. ✅

**"use client" directive on page-level or layout files:**
- `"use client"` was REMOVED from all three `page.tsx` files (agents/[id], pulls/[number], pulls). ✅
- `"use client"` correctly placed on leaf components: `AgentEditorPage.tsx`, `PRDetailView.tsx`, `PullsListView.tsx`, `ConfirmModal.tsx`. ✅

**Missing required prop / broken TypeScript type causing runtime error:**
- No obvious broken prop types or missing required props detected in the diff. ✅

**Utility or type imported across features from a _components/ folder:**
- `ConfirmModal` is placed in `src/components/confirm-modal/` (shared chrome, not a `_components/` folder) and consumed by multiple features. This is the correct placement per project conventions. ✅

**Component body > 200 lines:**
- `PRDetailView.tsx` — 185 lines. Approaching limit but under 200. ⚠️ (see Warnings)
- `AgentEditorPage.tsx` — 111 lines. ✅
- `PullsListView.tsx` — 130 lines. ✅
- `useShellContext.ts` — 109 lines. ✅

**useState / useEffect for server state (should be useQuery):**
- `PullsListView.tsx` uses `React.useState` for `query` (search text) and `sort` — these are local UI filter states, not server state. Correct usage. ✅
- `AgentEditorPage.tsx`, `PRDetailView.tsx` — All server data via `useQuery`-based hooks. ✅

**useEffect dependency array issues:**
- No new `useEffect` with obviously wrong dependencies detected in the diff. ✅

**No critical frontend architecture violations found.**

---

## Step 3 — Security Review

**Hardcoded credentials, tokens, or secrets:**
- No hardcoded credentials, API keys, or secrets found in any changed file. ✅

**XSS via dangerouslySetInnerHTML with user-controlled content:**
- No `dangerouslySetInnerHTML` usage in any changed file. ✅

**Unvalidated user input reaching database call:**
- All data mutations go through TanStack Query hooks → API layer. No direct DB calls in frontend. ✅

**Missing authentication check on a protected route:**
- No new route handlers added on the frontend that bypass authentication. ✅

**Potential path traversal or injection:**
- URL parameters (`repoId`, `number`, `id`) are used only to build navigation paths and passed to typed hooks — not concatenated into raw queries. ✅

**No security findings.**

---

## Step 4 — Additional Checks

### Test coverage

New test files added in this diff:
- `client/src/components/confirm-modal/ConfirmModal.test.tsx` — covers `ConfirmModal.tsx` ✅
- `client/src/app/repos/[repoId]/pulls/_components/FilterBar/FilterBar.test.tsx` — covers `FilterBar.tsx` ✅
- `client/src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.test.tsx` — covers `PRRow.tsx` ✅

Source files **without** corresponding test files (new or substantially modified):

| File | Status |
|------|--------|
| `client/src/app/agents/[id]/_components/AgentEditorPage/AgentEditorPage.tsx` | No test file |
| `client/src/app/agents/_components/AgentCard/AgentCard.tsx` | No test file |
| `client/src/app/repos/[repoId]/pulls/[number]/_components/PRDetailView/PRDetailView.tsx` | No test file |
| `client/src/app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx` | No test file |
| `client/src/app/repos/[repoId]/pulls/_components/PullsListView/PullsListView.tsx` | No test file |
| `client/src/components/app-shell/AppShell.tsx` | No test file |
| `client/src/components/app-shell/hooks/useShellContext.ts` | No test file |

Note: `page.tsx` files, `index.ts` barrels, and `styles.ts` are skipped per skill rules.

### PR size

- Total diff: 12,138 insertions + 695 deletions = **12,833 lines changed** (includes session logs, docs, and skill files)
- Client source code only (`client/src/`): **793 + 471 = 1,264 lines changed**
- Even scoping to just client source code, this exceeds the **500-line warning threshold**.

### INSIGHTS.md reminder

- > 10 source files changed and > 200 lines of logic
- `INSIGHTS.md` (root), `client/INSIGHTS.md`, `server/INSIGHTS.md` — all were updated in this diff. ✅

---

## Step 5 — Aggregated Findings

### Critical Issues
None.

### Warnings
1. **PRDetailView.tsx — 185 lines** — approaching the 200-line component limit; consider extracting the run/trace state management into a hook.
2. **AgentEditorPage.tsx — no test file** — component has conditional rendering and mutation logic; no test coverage.
3. **AgentCard.tsx — no test file** — modified to add ConfirmModal flow; no test coverage.
4. **PRDetailView.tsx — no test file** — largest new component (185 lines) with multiple data hooks and state; no test coverage.
5. **ReviewRunAccordion.tsx — no test file** — modified with ConfirmModal flow; no test coverage.
6. **PullsListView.tsx — no test file** — new 130-line view with filtering and sorting logic; no test coverage.
7. **AppShell.tsx / useShellContext.ts — no test file** — `useConfirmRemoveRepo` is a new stateful hook with mutation and routing logic; no test coverage.
8. **PR size > 500 lines** — client/src/ alone has 1,264 changed lines; the full diff is 12,833 lines (majority are session docs and new skill files, not product code).

### Info
None (INSIGHTS.md was updated; commit messages follow conventional-commits style).

---

## Step 6 — Gate Decision

✅ PASSED — Ready to open a PR.

## Warnings (8)

| File | Issue |
|------|-------|
| `client/src/app/repos/[repoId]/pulls/[number]/_components/PRDetailView/PRDetailView.tsx` | 185 lines — approaching 200-line component limit; consider extracting run/trace state into a hook |
| `client/src/app/agents/[id]/_components/AgentEditorPage/AgentEditorPage.tsx` | No test file — has conditional rendering + mutation logic |
| `client/src/app/agents/_components/AgentCard/AgentCard.tsx` | No test file — modified with ConfirmModal flow |
| `client/src/app/repos/[repoId]/pulls/[number]/_components/PRDetailView/PRDetailView.tsx` | No test file — largest new component |
| `client/src/app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx` | No test file — modified with ConfirmModal flow |
| `client/src/app/repos/[repoId]/pulls/_components/PullsListView/PullsListView.tsx` | No test file — new 130-line view with filter/sort logic |
| `client/src/components/app-shell/AppShell.tsx` + `hooks/useShellContext.ts` | No test file for `useConfirmRemoveRepo` — new stateful hook with mutation and routing |
| (overall diff) | PR diff is 1,264 lines in client/src/ (12,833 total including docs/skills) — larger than 500-line threshold |

## Info
None

---

✅ PASSED — Ready to open a PR.
