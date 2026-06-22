# React / Next.js Best Practices — Source Library

Curated references for architecture decisions in `client/` (@devdigest/web).
Used by the `/react-best-practices` skill.

Last updated: 2026-06-22

---

## Business Logic Placement

| Source | Focus |
|--------|-------|
| [Path To A Clean React Architecture (Part 6) — Business Logic Separation](https://profy.dev/article/react-architecture-business-logic-and-dependency-injection) | Extracting logic into custom hooks + dependency injection pattern |
| [Enhance Large React Components with Custom Hooks for Business Logic](https://medium.com/recur-club-engineering/enhance-large-react-components-with-custom-hooks-for-business-logic-fc5305f86788) | Practical refactor: moving logic out of components into hooks |
| [Production-Level Patterns for React Hooks](https://www.fullstack.com/labs/resources/blog/production-level-patterns-for-react-hooks) | Model/View/Controller split via hooks + components |
| [React Component Architecture: Best Practices for Scale](https://rtcamp.com/handbook/react-best-practices/component-architecture/) | SRP, container vs presentational, purity rules |

## Component Structure & Splitting

| Source | Focus |
|--------|-------|
| [React Folder Structure Best Practices [2026] — Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/) | Progressive complexity, public API via index.ts, feature promotion rules |
| [Popular React Folder Structures and Screaming Architecture](https://profy.dev/article/react-folder-structure) | Feature folders, screaming architecture concept |
| [Frontend Handbook — React / Project structure](https://infinum.com/handbook/frontend/react/project-structure) | Enterprise-grade structure, cross-feature dependency rules |
| [React Best Practices: Building Apps That Don't Fall Apart](https://yakhil25.medium.com/react-best-practices-building-apps-that-dont-fall-apart-b973ab2f2d73) | Colocation, state placement, component size thresholds |

## Utilities, Helpers, lib/

| Source | Focus |
|--------|-------|
| [Best Practices for Organizing Your Next.js 15 — DEV Community](https://dev.to/bajrayejoon/best-practices-for-organizing-your-nextjs-15-2025-53ji) | lib/ vs utils/ vs hooks/ distinction in Next.js 15 |
| [Getting Started: Project Structure — Next.js official docs](https://nextjs.org/docs/app/getting-started/project-structure) | Official Next.js App Router directory conventions |
| [The Ultimate Guide to Organizing Your Next.js 15 Project Structure](https://www.wisp.blog/blog/the-ultimate-guide-to-organizing-your-nextjs-15-project-structure) | One-way dependency flow: app → components → lib |
| [How to Build a Professional React Project Structure in 2025 — Netguru](https://www.netguru.com/blog/react-project-structure) | lib/ (wrappers) vs utils/ (pure functions) vs hooks/ (React logic) distinction |

## General Architecture & Patterns

| Source | Focus |
|--------|-------|
| [33 React JS Best Practices For 2025 — Technostacks](https://technostacks.com/blog/react-best-practices/) | Broad checklist: hooks, state, performance, naming |
| [React Architecture Patterns and Best Practices for 2026 — Bacancy](https://www.bacancytechnology.com/blog/react-architecture-patterns-and-best-practices) | Layered architecture patterns overview |
| [React & Next.js in 2025 — Modern Best Practices — Strapi](https://strapi.io/blog/react-and-nextjs-in-2025-modern-best-practices) | App Router specifics, Server Components vs Client Components split |
| [React Architecture Pattern and Best Practices — GeeksforGeeks](https://www.geeksforgeeks.org/reactjs/react-architecture-pattern-and-best-practices/) | MVC-like patterns in React explained |
| [How to Structure a React App in 2025 — Ramon Prata (Medium)](https://ramonprata.medium.com/how-to-structure-a-react-app-in-2025-spa-ssr-or-native-10d8de7a245a) | SPA vs SSR structure differences |

---

## Key Principles (TL;DR)

1. **Business logic → hooks.** Components render; hooks compute.
2. **Colocate first, promote second.** Logic starts next to the component that needs it; move to `src/lib/` only when a second consumer appears.
3. **`lib/` = third-party wrappers + API client.** `utils/` = pure functions. `hooks/` = React stateful logic.
4. **Pages are thin.** All non-routing logic lives in `_components/<Name>/`.
5. **200-line rule.** Component > 200 lines → extract subcomponent or hook.
6. **Public API via `index.ts`.** Every `_components/<Name>/` exposes one barrel file; internals are private.
7. **One-way dependency flow.** `app/` → `components/` → `lib/` → `utils/`. Never reverse.
