# client/ — agent map (@devdigest/web)

→ Human docs: README.md

## Commands
```sh
pnpm dev          # web app on :3000
pnpm test         # vitest + jsdom, fetch mocked — no API needed
pnpm typecheck
pnpm build
```

## Where things live
```
src/app/**/page.tsx         routes (App Router)
src/app/**/_components/     feature components colocated with their page
src/components/             shared chrome: AppShell · DiffViewer · PageShell
src/lib/hooks/              TanStack Query hooks — all API calls go here
src/lib/api.ts              single fetch client (NEXT_PUBLIC_API_BASE)
src/vendor/ui/              vendored UI primitives (@devdigest/ui)
src/vendor/shared/          Zod contracts mirror (@devdigest/shared)
messages/<locale>/          i18n strings (next-intl)
```

## Non-default conventions
- Data fetching = TanStack Query only — no fetch() calls directly in components
- Pages are thin; all logic lives in colocated `_components/<Name>/` folders
- Each `_components/<Name>/` has its own `*.test.tsx`
- Keyboard shortcuts live in `src/components/app-shell` (g-then-key pattern)

## Gotchas
- API base = `NEXT_PUBLIC_API_BASE` (default `http://localhost:3001`) — must be set in client/.env
- Vendored shared contracts in `src/vendor/shared/` must stay in sync with `server/src/vendor/shared/`
- No Playwright — real browser e2e lives in e2e/ (agent-browser)
- Component tests run under jsdom with fetch mocked — they do NOT catch API contract mismatches

## Writing insights
After completing non-trivial work, add findings to insights/INSIGHTS.md.

**Add:** unexpected behaviors, hidden constraints, non-obvious patterns, decisions with reasoning, gotchas discovered.
**Do NOT add:** things obvious from code, standard practices, volatile/in-progress state.
