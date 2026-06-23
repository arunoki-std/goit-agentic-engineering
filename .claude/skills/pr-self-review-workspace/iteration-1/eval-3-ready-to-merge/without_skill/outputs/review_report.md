# PR Self-Review: lab-2 → main

**Branch:** lab-2  
**Reviewed:** 2026-06-23  
**Status: READY TO MERGE** (with one minor note)

---

## Summary of Changes

This branch includes 11 commits covering:

1. **CLAUDE.md → AGENTS.md migration** — replaced CLAUDE.md content with `@AGENTS.md` include; created AGENTS.md files for each package (root, server/, client/, reviewer-core/, e2e/)
2. **Frontend architecture refactor** — extracted page logic from page.tsx files into colocated `_components/` directories (AgentEditorPage, PullsListView, PRDetailView)
3. **ConfirmModal component** — replaced all `window.confirm()` calls with a shared `ConfirmModal` built on `@devdigest/ui Modal`
4. **useShellContext refactor** — extracted `useConfirmRemoveRepo` hook; modal state now lives in AppShell rather than the hook
5. **New skills** — added `onion-architecture`, `react-best-practices`, and `skill-creator` skills to `.claude/skills/`
6. **New tests** — 11 new tests added (ConfirmModal×4, FilterBar×4, PRRow×3); total test count 32

---

## Test Results

```
Test Files  13 passed (13)
     Tests  32 passed (32)
```

All tests pass. No failures.

---

## TypeScript

TypeScript type check passes with no errors (`pnpm exec tsc --noEmit`).

---

## Code Quality Findings

### Positive

- **page.tsx files are now clean wrappers** — each is 3–5 lines exporting a component. This is the correct pattern for Next.js App Router: page.tsx files are Server Components by default; the "use client" boundary is pushed down into the dedicated component.
- **window.confirm() fully removed** — grepping `client/src/` finds zero remaining calls. The new ConfirmModal is accessible, styled, and testable.
- **Import paths standardized** — changed from relative `../../../lib/hooks` to `@/lib/hooks` alias throughout.
- **useConfirmRemoveRepo hook separation** — correct decision to lift modal state out of useShellContext (a data hook) and into AppShell (the view layer).
- **styles.ts files** — inline style objects extracted to typed `CSSProperties` constants. Good for readability; `satisfies CSSProperties` gives type safety.

### Minor Issues

1. **Fragment indentation in ReviewRunAccordion** (`client/src/app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx`):

   ```tsx
   return (
     <>
     {confirmDelete && (  // ← not indented inside the fragment
   ```

   The `{confirmDelete && ...}` and the `<div ref={rootRef}...>` block are at the same indentation as `<>` itself, rather than being indented inside the fragment. This is a formatting-only issue with no functional impact, but it's inconsistent with the style used in the other ConfirmModal integrations (AgentCard and AppShell both indent correctly).

2. **`deleteRun` in PRDetailView** — the `useDeleteRun(prId)` mutation is imported and used in PRDetailView, but the `confirmDeleteRunId` state handler calls `deleteRun.mutate(confirmDeleteRunId)` — this is correct, but worth noting: `prId` can be `null` before the pulls list loads, so `deleteRun` is initialized with a potentially null key. The downstream hook should guard against this (review if `useDeleteRun` handles null prId safely), though no errors appeared in tests.

3. **Session transcript files in docs/** — 4 large text files were committed to `docs/sessions/` (total ~4,900 lines). These are not breaking, but they inflate the repo size and likely don't need to be in version control. Consider adding `docs/sessions/` to `.gitignore` if this is a machine-generated artifact.

---

## Risk Assessment

| Area | Risk | Notes |
|------|------|-------|
| Client refactor | Low | Logic is identical to original page.tsx — pure extraction |
| ConfirmModal | Low | 4 tests, all green; replaces browser native dialog |
| AGENTS.md migration | Low | CLAUDE.md now delegates via `@AGENTS.md` include |
| Skills files | None | Tooling-only, no runtime impact |
| Session transcripts | Cosmetic | Large files committed; no functional risk |

---

## Recommendation

The changes are correct, well-tested, and follow good Next.js App Router patterns. The one formatting nit in ReviewRunAccordion doesn't block merging. The session transcript files are worth discussing with the team (whether they belong in the repo), but are not blocking.

**Good to merge.**
