---
name: react-best-practices
description: Answer architecture questions for the client/ Next.js 15 App Router frontend (@devdigest/web) — where business logic goes, how to split components, where utilities/helpers/hooks live, TanStack Query vs fetch(), colocated _components/ structure, Server vs Client Components. Use this skill whenever the user asks about file placement, component organization, folder structure, hook patterns, or architecture decisions in the client/ package, even if they don't explicitly mention "best practices."
allowed-tools: Read, Bash(grep:*, find:*)
---

# React Best Practices — client/ (@devdigest/web)

Answer architecture questions for the `client/` package (Next.js 15 · TanStack Query · App Router). Always ground answers in the project's **existing conventions first**.

## Project structure (key facts)

```
src/app/**/page.tsx           ← route only; zero logic
src/app/**/_components/<N>/   ← ALL feature logic lives here (colocated)
src/components/               ← shared chrome (AppShell, DiffViewer, PageShell)
src/lib/hooks/<domain>.ts     ← ALL TanStack Query hooks; all API calls go here
src/lib/api.ts                ← single fetch client
src/vendor/ui/                ← vendored UI primitives
src/vendor/shared/            ← Zod contract mirror
```

If the project has changed, read `client/AGENTS.md` to confirm the current layout.

---

## Where does business logic go?

**Rule: logic goes into hooks, never directly into components.**

Decision tree:
```
Is it a fetch / server state?
  → src/lib/hooks/<domain>.ts  (TanStack Query useQuery/useMutation)

Is it UI state or derived state for one feature only?
  → _components/<Name>/hooks.ts  (colocated custom hook)

Is it pure transformation (no React — format, filter, sort)?
  → _components/<Name>/helpers.ts  (feature-local)
  → src/lib/<util>.ts  (if used by 2+ features)

Is it a side effect (toast, router push)?
  → event handler in the component; never in render
```

**Anti-pattern → correct:**
```tsx
// ❌ fetch() directly in a component — breaks TanStack Query cache
function AgentCard({ id }: { id: string }) {
  const [agent, setAgent] = useState(null);
  useEffect(() => { fetch(`/api/agents/${id}`).then(...).then(setAgent); }, [id]);
  return <div>{agent?.name}</div>;
}

// ✅ TanStack Query hook in src/lib/hooks/agents.ts
// src/lib/hooks/agents.ts
export function useAgent(id: string) {
  return useQuery({ queryKey: ['agent', id], queryFn: () => api.get(`/agents/${id}`) });
}
// AgentCard.tsx
function AgentCard({ id }: { id: string }) {
  const { data: agent } = useAgent(id);
  return <div>{agent?.name}</div>;
}
```

---

## How should components be split?

**Rule: one component = one responsibility. Pages are thin wrappers.**

Each feature component lives in `_components/<Name>/`:
```
_components/<Name>/
├── <Name>.tsx        ← renders JSX, reads from hooks
├── index.ts          ← barrel (public API)
├── hooks.ts          ← feature-scoped TanStack / useState logic
├── helpers.ts        ← pure transformations
├── constants.ts      ← local magic values
├── styles.ts         ← cva/clsx definitions
└── <Name>.test.tsx   ← vitest tests
```

- **`page.tsx`:** imports one top-level feature component, passes route params. Zero logic.
- **200-line rule:** component body > 200 lines → extract subcomponent into `_components/<Name>/_components/<Sub>/`, or move logic into a hook.
- **Nesting:** one extra level deep is fine (`_components/<Name>/_components/<Sub>/`). Beyond two levels → promote to `src/components/`.
- **Reusable UI with no feature coupling** → `src/components/`.

**Anti-pattern → correct:**
```tsx
// ❌ Business logic in page.tsx
export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  useEffect(() => { fetch('/api/agents').then(...).then(setAgents); }, []);
  return agents.map(a => <div key={a.id}>{a.name}</div>);
}

// ✅ Thin page — delegates to feature component
export default function AgentsPage() {
  return <AgentsListView />;
}
// All logic lives in src/app/agents/_components/AgentsListView/AgentsListView.tsx
```

---

## Where do utilities and helpers go?

| What | Where |
|------|-------|
| Pure function used only inside one `_components/<Name>/` | `_components/<Name>/helpers.ts` |
| Pure function shared by 2+ features | `src/lib/<domain>.ts` (e.g. `github-urls.ts`, `model-label.ts`) |
| TanStack Query hook | `src/lib/hooks/<domain>.ts` |
| API fetch client / base URL | `src/lib/api.ts` |
| Third-party library wrapper | `src/lib/<lib-name>.ts` |
| Constants scoped to one feature | `_components/<Name>/constants.ts` |
| Constants used app-wide | `src/lib/constants.ts` |
| Types scoped to one feature | Inside the feature folder |
| Types shared across features | `src/lib/types.ts` |

**Promotion rule:** start colocated, promote to `src/lib/` only when a *second* consumer appears.

---

## Where does state live?

- **Server state** (API data) → TanStack Query via `src/lib/hooks/`
- **Local UI state** (open/closed, tab, filter) → `useState` inside the component that needs it; don't lift unless a sibling needs it
- **Shared UI state** (active repo) → React Context in `src/lib/<context>.tsx` (e.g. `repo-context.tsx`)
- **URL state** (filters that survive refresh/share) → `useSearchParams` / Next.js router

---

## Server Components vs Client Components

- **Default: Server Component.** No `"use client"` unless you need interactivity.
- `"use client"` is required for: `useState`, `useEffect`, event handlers, browser APIs, TanStack Query hooks.
- Keep the `"use client"` boundary **as low as possible** — push it to leaf components, not page wrappers.

**Anti-pattern → correct:**
```tsx
// ❌ "use client" at the page level — prevents Server Component optimization
"use client";
export default function PullsPage() { ... }

// ✅ "use client" only on the interactive leaf
// page.tsx — Server Component (no directive)
export default function PullsPage() { return <FindingsTab />; }

// _components/FindingsTab/FindingsTab.tsx
"use client";
export function FindingsTab() { /* needs useState */ }
```

---

## Giving a concrete answer

1. State the rule in one sentence.
2. Show the exact file path where the code should go (relative to `client/src/`).
3. If helpful, show a minimal code sketch (≤ 15 lines).
4. If the question reveals an anti-pattern, name it explicitly and show the correct pattern.
5. If the user wants to go deeper, point them to `client/docs/react-best-practices-sources.md` — organized by topic (business logic, component splitting, lib/ vs utils/).

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

src/lib/hooks/<domain>.ts  ← shared TanStack Query hooks (ALL API calls)
src/lib/api.ts             ← fetch client
src/lib/types.ts           ← shared types
src/lib/<util>.ts          ← shared pure helpers (promote from feature)
src/components/            ← shared chrome, no feature coupling
```

Anti-patterns to flag immediately:
- `fetch()` directly in a component → move to `src/lib/hooks/`
- Business logic in `page.tsx` → move to `_components/<Name>/`
- God component > 200 lines → split into subcomponent or hook
- Utility imported across features from a `_components/` folder → promote to `src/lib/`
- `"use client"` at the page level → push down to the leaf that needs it
