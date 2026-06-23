---
name: pr-self-review
description: Use before opening a GitHub pull request to run a local quality gate. Invoke this skill whenever the user runs or mentions `gh pr create`, `gh pr`, or says "open PR", "create PR", "push PR", "ready to merge", "submit for review", or "merge my changes" — even if they don't explicitly ask for a review. Also invoke immediately on the /pr-self-review command. Do NOT invoke when reviewing someone else's PR, running read-only `gh` commands like `gh pr list` or `gh pr view`, or discussing code without intent to merge.
allowed-tools: Bash(git:*, gh:*), Read, Skill
---

# PR Self-Review Gate

A local quality gate that runs before `gh pr create`. It discovers what changed on this branch, routes changed files to the right architectural reviewers, checks for security issues, and produces a BLOCKED or PASSED verdict.

The purpose is to catch critical problems **locally** before they become PR comments, failed CI, or production bugs.

Start by reading `references/severity-rules.md` — it defines what makes a finding critical vs. a warning, with concrete examples for this project's React frontend and onion-architecture backend.

---

## Step 1 — Discover changed files

Detect the default branch dynamically (it may be `main`, `master`, or something else):

```bash
git remote show origin | grep 'HEAD branch' | awk '{print $NF}'
```

Then get the full list of changed files vs. that default branch:

```bash
git diff <default-branch>...HEAD --name-only
git diff <default-branch>...HEAD --stat
```

Parse the file list into three groups:
- **Frontend** — any path starting with `client/`
- **Backend** — any path starting with `server/src/` (documentation-only changes in `server/` are not code changes — skip them for architecture review)
- **Other** — root files, docs, config, `.claude/`, `e2e/`, `reviewer-core/`

If there are zero changed files (clean branch), report: "No changes detected vs. `<branch>`. Nothing to review." and stop.

---

## Step 2 — Architecture review

### Frontend files (client/)

If any `client/` files changed:

1. Read `.claude/skills/react-best-practices/SKILL.md` to load the architecture rules into your context.
2. Get the diff for changed client files: `git diff <default-branch>...HEAD -- client/`
3. Review each change against these anti-patterns (defined in the skill you just read):

   | Anti-pattern | Severity |
   |---|---|
   | `fetch()` / `axios()` called directly inside a component body or `useEffect` | **critical** |
   | Business logic or API calls in `page.tsx` (route file) | **critical** |
   | `"use client"` directive on a page-level or layout file | **critical** |
   | Missing required prop / broken TypeScript type causing a runtime error | **critical** |
   | Utility or type imported across features from a `_components/` folder | **warning** |
   | Component body > 200 lines with no hook or subcomponent extraction | **warning** |
   | `useState` / `useEffect` used for server state that should be `useQuery` | **warning** |
   | `useEffect` dependency array that is clearly wrong (missing deps or stale closure) | **warning** |

4. Record each violation: `{ file, line (if known), issue, severity }`.

### Backend source files (server/src/)

If any `server/src/` files changed (not just docs):

1. Read `.claude/skills/onion-architecture/SKILL.md` to load the architecture rules.
2. Get the diff: `git diff <default-branch>...HEAD -- server/src/`
3. Review against layer violations:

   | Anti-pattern | Severity |
   |---|---|
   | `service.ts` importing directly from `db/schema/*` | **critical** |
   | `routes.ts` calling a repository directly (bypassing service) | **critical** |
   | `routes.ts` containing `if/else` business logic | **critical** |
   | Service importing a concrete adapter class directly (not via container) | **critical** |
   | Cross-module import of another module's `repository.ts` | **critical** |
   | Job scheduling (`container.jobs.enqueue`) called inside `repository.ts` | **warning** |
   | Business logic in `helpers.ts` that has side effects | **warning** |
   | New module missing `workspaceId` scope in repository queries | **warning** |

4. Record each violation: `{ file, issue, severity }`.

---

## Step 3 — Security review

Invoke the `security-review` skill. It will analyze the full diff for security vulnerabilities. Note all findings it reports and their severity labels.

If `security-review` doesn't assign severities, apply these rules from `references/severity-rules.md`:
- Hardcoded credentials, tokens, or secrets in any file → **critical**
- XSS via `dangerouslySetInnerHTML` with user-controlled content → **critical**
- Unvalidated user input reaching a database call → **critical**
- Missing authentication check on a protected route → **critical**
- Potential path traversal or injection with user-controlled strings → **warning**

---

## Step 4 — Additional checks

### Test coverage
For each changed source file (`*.ts`, `*.tsx`) in `client/src/` or `server/src/`:
- Check if a corresponding test file exists in the same directory (e.g., `Foo.tsx` → `Foo.test.tsx`) or in `server/test/`.
- Files with no test coverage: **warning**.
- Skip this check for `index.ts` barrels, `constants.ts`, `styles.ts`, and pure type files.

### PR size
From the `--stat` output, sum total lines added + removed. If total > 500 lines: **warning** — large PRs are harder to review and more likely to hide issues.

### INSIGHTS.md reminder
If the diff touches > 10 source files or > 200 lines of logic, check whether the relevant `INSIGHTS.md` (in `client/`, `server/`, or root) was updated. If not: **info** — remind the user to record any non-obvious findings per the session protocol in `AGENTS.md`.

---

## Step 5 — Classify and aggregate findings

Apply the rules from `references/severity-rules.md` to every finding collected in Steps 2–4. Combine findings from architecture review, security review, and additional checks into one list, deduplicating anything that was flagged by both sources.

Severity levels:
- **critical** — must be fixed before the PR can be opened
- **warning** — should be addressed but won't block the PR
- **info** — non-blocking suggestion or process reminder

---

## Step 6 — Gate decision and output

Count the critical findings. Produce the final report:

### If ≥ 1 critical finding:

```
❌ BLOCKED — {N} critical issue(s) found. Fix these before opening a PR.

## Critical Issues
| File | Issue | Suggested Fix |
|------|-------|---------------|
| path/to/file.tsx | fetch() called directly in component | Move to src/lib/hooks/domain.ts using useQuery |
| ... | ... | ... |

## Warnings ({N})
| File | Issue |
|------|-------|
| ... | ... |
(or "None")

## Info
- INSIGHTS.md not updated — consider logging any non-obvious findings
(or "None")
```

### If 0 critical findings:

```
✅ PASSED — Ready to open a PR.

## Warnings ({N})
| File | Issue |
|------|-------|
| ... | ... |
(or "None")

## Info
- ...
(or "None")
```

Always end with the gate status on a standalone line so it's easy to scan at a glance.

---

## Notes on sub-skill invocation

When invoking `security-review` via the Skill tool, it runs its full workflow against the current branch diff. You do not need to pass it the file list — it reads `git diff` itself. Once it completes, incorporate its findings into your aggregated list for Step 5.

If `security-review` is unavailable, perform a manual scan of the diff for the security patterns listed in Step 3.
