---
name: react-best-practices
description: Answer architecture questions for the client/ Next.js frontend — where business logic goes, how to split components, where utilities/helpers live. Gives project-specific answers backed by curated sources in client/docs/react-best-practices-sources.md.
allowed-tools: Read, Bash(grep:*, find:*)
---

# React Best Practices — client/ (@devdigest/web)

Answer architecture questions for the `client/` package. Always ground answers in the project's **existing conventions first**, then in the curated best-practices sources.

## Step 1 — Read project conventions

Read `client/AGENTS.md` to recall the current project structure and non-default conventions before answering.

Key facts already established in the project:
- `src/app/**/page.tsx` — routes only, no logic
- `src/app/**/_components/<Name>/` — all feature logic colocated here
- `src/components/` — shared chrome (AppShell, DiffViewer, PageShell)
- `src/lib/hooks/` — ALL TanStack Query hooks; all API calls go here
- `src/lib/api.ts` — single fetch client
- `src/vendor/ui/` — vendored UI primitives
- `src/vendor/shared/` — Zod contract mirror

## Step 2 — Map the question to the right rule

### Where does business logic go?

**Rule:** Logic goes into hooks, never into components directly.

- **Data fetching** → `src/lib/hooks/<domain>.ts` (TanStack Query). No `fetch()` in components.
- **Feature-scoped logic** (derived values, local mutations, UI state machines) → `_components/<Name>/hooks.ts` or a colocated custom hook inside the same folder.
- **Cross-feature logic** (shared between two or more features) → `src/lib/hooks/<domain>.ts`.
- **Pure transformations** (format, filter, sort, map) with no React → `_components/<Name>/helpers.ts` or `src/lib/<domain>.ts` if shared.

Decision tree:
```
Is it a fetch / server state?
  → src/lib/hooks/<domain>.ts (TanStack Query)

Is it UI state or derived state for one feature?
  → _components/<Name>/hooks.ts or inline custom hook

Is it pure transformation (no React)?
  → _components/<Name>/helpers.ts (feature-local)
  → src/lib/<util>.ts (if used by 2+ features)

Is it a side effect (toast, router push)?
  → event handler inside the component; never in render
```

### How should components be split?

**Rule:** One component = one responsibility. Pages are thin wrappers.

- `page.tsx` only: imports a single top-level feature component and passes route params. Zero logic.
- Each feature component lives in `_components/<Name>/` with this anatomy:
  ```
  _components/<Name>/
  ├── <Name>.tsx        ← the component
  ├── index.ts          ← barrel (public API)
  ├── helpers.ts        ← pure helpers for this component
  ├── constants.ts      ← local constants / enum-like values
  ├── styles.ts         ← cva / clsx style definitions
  └── <Name>.test.tsx   ← vitest + jsdom tests
  ```
- **200-line rule:** Component body > 200 lines → extract a subcomponent into its own `_components/<Sub>/` folder, or move logic into a hook.
- **Nested `_components/`:** Allowed one extra level deep for sub-components used only by the parent (`_components/<Name>/_components/<Sub>/`). Beyond two levels → promote to shared.
- Reusable UI that has no feature coupling → `src/components/`.

### Where do utilities and helpers go?

| What | Where |
|------|-------|
| Pure function used only inside one `_components/<Name>/` | `_components/<Name>/helpers.ts` |
| Pure function shared by 2+ features | `src/lib/<domain>.ts` (e.g. `github-urls.ts`, `model-label.ts`) |
| TanStack Query hook | `src/lib/hooks/<domain>.ts` |
| API fetch client / base URL config | `src/lib/api.ts` |
| Third-party library wrapper | `src/lib/<lib-name>.ts` |
| Constants scoped to one feature | `_components/<Name>/constants.ts` |
| Constants used app-wide | `src/lib/constants.ts` (create if absent) |
| Type-only file scoped to one feature | Inside the feature folder |
| Types shared across features | `src/lib/types.ts` |

**Promotion rule:** Start colocated. Promote to `src/lib/` only when a *second* consumer appears. Don't prematurely abstract.

### Where does state live?

- **Server state** (anything from the API) → TanStack Query via `src/lib/hooks/`.
- **Local UI state** (open/closed, selected tab, filter value) → `useState` inside the component that needs it. Do not lift unless another component needs it.
- **Shared UI state** (e.g. active repo) → React Context in `src/lib/<context>.tsx` (e.g. `repo-context.tsx`).
- **URL state** (filters that should survive refresh/share) → `useSearchParams` / Next.js router.

### Server Components vs Client Components (Next.js App Router)

- Default: Server Component. No `"use client"` unless you need interactivity.
- `"use client"` triggers: `useState`, `useEffect`, event handlers, browser APIs, TanStack Query.
- Keep `"use client"` boundary as low as possible — push it to leaf components, not page-level wrappers.
- Data-fetching in Server Components uses direct `fetch()` or server-side TanStack Query (not client hooks).

## Step 3 — Give a concrete, project-specific answer

When answering the user:
1. State the rule in one sentence.
2. Show the file path where the code should go (relative to `client/src/`).
3. If relevant, show a minimal code sketch (< 15 lines).
4. If the user's question reveals a potential anti-pattern, name it explicitly.

## Step 4 — Reference sources if asked

If the user wants deeper reading, point them to:
```
client/docs/react-best-practices-sources.md
```

Top sources by topic:
- **Business logic in hooks:** Robin Wieruch folder structure, rtcamp.com component architecture
- **Component splitting:** Robin Wieruch, Infinum handbook, profy.dev screaming architecture
- **lib/ vs utils/ vs hooks/:** Netguru project structure, Next.js official project structure docs

---

## Quick-reference cheat sheet

```
page.tsx                   ← route only; import one feature component
_components/<Name>/        ← everything for that feature
  <Name>.tsx               ← renders JSX, reads from hooks
  hooks.ts                 ← feature-scoped TanStack / useState logic
  helpers.ts               ← pure transformations
  constants.ts             ← local magic values
  styles.ts                ← cva/clsx definitions
  index.ts                 ← public barrel
  <Name>.test.tsx          ← vitest tests

src/lib/hooks/<domain>.ts  ← shared TanStack Query hooks
src/lib/api.ts             ← fetch client
src/lib/types.ts           ← shared types
src/lib/<util>.ts          ← shared pure helpers (promote from feature)
src/components/            ← shared chrome, no feature coupling
```

Anti-patterns to flag:
- `fetch()` directly in a component → move to `src/lib/hooks/`
- Business logic in `page.tsx` → move to `_components/<Name>/`
- God component > 200 lines with mixed fetch + render → split
- Utility imported across features from a `_components/` folder → promote to `src/lib/`
- `"use client"` at the page level → push down to the leaf that needs it
