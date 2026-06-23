# Severity Classification Rules for PR Self-Review

Use these rules when classifying each finding in Step 5 of the pr-self-review gate.

---

## Critical — blocks the PR

A finding is **critical** when it would cause any of the following on merge:
- A runtime error or crash in production
- A security vulnerability exploitable by users or external actors
- A clear architectural violation that degrades the codebase's long-term correctness
- A broken build or test failure

### Frontend (React / Next.js) — critical examples

| Pattern | Why it's critical |
|---|---|
| `fetch()` or `axios()` directly inside a component body or `useEffect` | Bypasses TanStack Query cache, causes duplicate requests, stale data, no loading/error state management |
| API call or business logic placed directly in `page.tsx` | Couples routing to data fetching, violates the project's thin-page convention, breaks colocation model |
| `"use client"` added to a page-level (`page.tsx`) or layout file | Forces the entire subtree into a Client Component, destroying Server Component optimization |
| TypeScript type error that would cause a runtime crash (e.g., missing required prop, `any` cast masking a null dereference) | Breaks at runtime even if it builds with `noEmit` |
| `dangerouslySetInnerHTML` receiving user-controlled content without sanitization | XSS vulnerability |
| Secret or API key hardcoded in client-side code | Exposed in browser, extractable by any user |
| Broken import path (imported module or symbol doesn't exist) | Build failure |

### Backend (Node.js / onion architecture) — critical examples

| Pattern | Why it's critical |
|---|---|
| `service.ts` importing `db/schema/*` directly (Drizzle table definition) | Service layer directly coupled to infrastructure — breaks the dependency rule, makes services untestable without a real DB |
| `routes.ts` calling a repository constructor directly | Bypasses the service layer entirely — business logic no longer has a home, can't be tested via ContainerOverrides |
| `routes.ts` containing `if/else` branching on business state | Business logic belongs in `service.ts`; routes are HTTP-only (parse → call → respond) |
| Service importing a concrete adapter class (e.g., `import { GitHubClient } from '../../adapters/github'`) | Hard-couples the service to infrastructure, breaks DI and testability |
| Cross-module import of another module's `repository.ts` | Modules must communicate via service interfaces or container, not by accessing each other's data layer |
| Raw `db.select()` in a `routes.ts` or `service.ts` | Drizzle queries must live exclusively in `repository.ts` |
| Hardcoded secret, password, or API token in any backend file | Security vulnerability; secrets must come from the secrets module |
| SQL / query built via string concatenation with user-controlled input | Injection vulnerability |
| Missing authentication/authorization check on a new protected route | Unauthorized access |

### General — critical for any file type

| Pattern | Why it's critical |
|---|---|
| Hardcoded credential, API key, token, or password | Exposed in version control |
| Test file deleted with no replacement or documented reason | Reduces test coverage silently |
| Broken import (module or symbol does not exist at the path) | Build failure |
| Dependency on a non-existent function or removed export | Runtime error |

---

## Warning — should be fixed, won't block the PR

A finding is a **warning** when it represents a code smell, a missing safety net, or a deviation from conventions that doesn't immediately break anything but will accumulate into a problem.

| Pattern | Category |
|---|---|
| Changed `*.ts` / `*.tsx` file has no corresponding test file | Missing coverage |
| `useState` / `useEffect` used for data that comes from an API (should be `useQuery`) | React anti-pattern |
| `useEffect` dependency array is suspicious (empty `[]` with internal deps, or missing obvious deps) | Subtle bug risk |
| Component body approaching 200 lines (150–200 range) with no extraction | Complexity |
| Utility or type imported across feature boundaries from a `_components/` folder | Coupling |
| Magic numbers or strings with no named constant and no obvious meaning | Readability |
| PR total diff > 500 lines changed | Reviewability |
| Duplicate logic visible in the diff that already exists elsewhere | DRY violation |
| Job scheduling (`container.jobs.enqueue`) inside `repository.ts` | Layer misplacement |
| TODO or FIXME added in the diff with no linked issue number | Untracked debt |
| `console.log` / `console.debug` left in production code | Noise |

---

## Info — non-blocking suggestion or process reminder

A finding is **info** when it is a suggestion, a question, or a project process reminder that the developer should see but doesn't need to act on before merging.

| Pattern | Category |
|---|---|
| INSIGHTS.md not updated for a substantive change (>10 files or >200 lines) | Process reminder |
| A helper function in the diff has a second obvious consumer — candidate for promotion to `src/lib/` | Refactor opportunity |
| Commit message doesn't follow conventional commits format | Convention |
| A complex function in the diff has no JSDoc or explanatory comment | Documentation |
| A deprecated pattern is used that's still functional but has a preferred replacement | Future-proofing |

---

## Edge cases

- **A finding flagged by both architecture review and security review**: count it once, at the higher severity.
- **An anti-pattern that's clearly intentional** (e.g., a comment explains the workaround): downgrade one level, but still report it.
- **A test file that tests the missing coverage**: if the test file is also new in the diff, don't flag the source file as untested.
- **Documentation files only** (`*.md`, `AGENTS.md`, `INSIGHTS.md`, `CLAUDE.md`): apply no severity classification — these are never critical or warning.
