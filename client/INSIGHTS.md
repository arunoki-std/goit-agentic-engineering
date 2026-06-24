# INSIGHTS.md — client/ (@devdigest/web)

Next.js 15 App Router · TanStack Query · next-intl · recharts

Entry format: `[YYYY-MM-DD] <finding> — <file:line if applicable>`
Rules: append-only; correct with a dated note, never overwrite; terse + actionable "cold".
Prune quarterly.

---

## What Works

<!-- Підходи й рішення, що спрацювали в client/ -->
[2026-06-23] Коли hook викликає `window.confirm()`, перенести підтвердження у консьюмер-компонент: hook отримує `onRequest(id, name)` callback, всередині hook — `request/confirm/cancel` трійця стану, компонент рендерить `<ConfirmModal>` — так JSX не потрапляє у hook; прецедент: useConfirmRemoveRepo() + AppShell.tsx — src/components/app-shell/hooks/useShellContext.ts
[2026-06-23] `Modal` вже є в `@devdigest/ui` (vendor/ui/kit/Modal.tsx) — реекспортується через `export * from "./kit"`; не потрібно писати власний dialog — src/vendor/ui/kit/Modal.tsx
[2026-06-24] `useMutation.variables` holds the current mutation's input while `isPending` is true — use `update.variables?.id === c.id` to show per-row loading state in a list without adding local state — src/app/repos/[repoId]/conventions/_components/ConventionsView/ConventionsView.tsx

## What Doesn't Work

<!-- Глухі кути й антипатерни — найцінніша секція -->
<!-- Приклад: [2026-06-19] fetch() напряму в компоненті — ламає кеш TanStack Query; завжди через src/lib/hooks/ -->
[2026-06-22] Передавати фільтр-параметр у queryKey TanStack Query = окремий cache entry на кожне значення → ламає deduplication; фільтрувати client-side у helpers.ts на вже отриманих даних — AgentsListView/helpers.ts
[2026-06-22] `useSearchParams` для фільтра — тільки якщо значення має виживати після рефреш або бути shareable; якщо ні — `useState`; прецедент URL-стану: src/app/repos/[repoId]/pulls/page.tsx, без URL-стану: agents list
[2026-06-23] Omitting `AppShell` from a page view silently renders without the left nav sidebar — no error, just missing chrome; every full-page view needs `<AppShell crumb={…}>` as the outermost element — src/app/skills/_components/SkillsView/SkillsView.tsx
[2026-06-23] `height: "100%"` fails for full-height two-panel layouts — AppFrame's `<main>` has `overflow: "auto"` which lets it grow to content, breaking height inheritance; fix: `height: "calc(100vh - 52px)"` (52 = topbar) as used in AgentEditorPage/styles.ts:4

## Codebase Patterns

<!-- Non-default конвенції client/ -->
<!-- Приклад: [2026-06-19] Сторінки тонкі — вся логіка в _components/<Name>/; не класти бізнес-логіку в page.tsx -->
[2026-06-22] RunTraceDrawer — канонічний прецедент вкладених _components/ (TraceBody, FindingsSection, PromptBlock тощо); орієнтуватись на нього при розбитті великих компонентів — src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/

## Tool & Library Notes

<!-- Квірки Next.js 15, TanStack Query, next-intl -->
[2026-06-23] recharts виводить `width(0) and height(0) of chart should be greater than 0` у stderr при кожному запуску `pnpm test` — це jsdom-шум (відсутній layout engine), не помилка; не витрачати час на розслідування — src/test/smoke.test.tsx
[2026-06-23] Vendored `Drawer` (vendor/ui/kit/Drawer.tsx:57) internally applies `padding: 24` to its children container — full-width children (tab bars, dividers) must use a `margin: "-24px"` wrapper to break out; there's no `noPad` prop — src/vendor/ui/kit/Drawer.tsx

## Recurring Errors & Fixes

<!-- Повторювані помилки + фікс -->
<!-- Приклад: [2026-06-19] Контракти розсинхронізувались — src/vendor/shared/ ≠ server/src/vendor/shared/ -->
[2026-06-23] Шлях до `messages/` у тестах: директорія `messages/` — на рівні `client/`, а НЕ `client/src/`; з `src/app/repos/[repoId]/pulls/_components/FilterBar/` потрібно 7 `../` (а не 6) щоб дістатись до `client/messages/` — FilterBar.test.tsx:4
[2026-06-23] `@testing-library/user-event` не встановлено у client/; використовувати `fireEvent` з `@testing-library/react` — перевірити перед написанням нових тестів: `ls client/node_modules/@testing-library/`
[2026-06-23] `FormField` (vendor/ui/kit/FormField.tsx) приймає `hint` але НЕ `style` — обертай у `<div style={…}>` для margin; `TextInput` теж НЕ приймає `hint` — переноси hint у `FormField hint=` prop — src/vendor/ui/kit/FormField.tsx
[2026-06-23] Vendored icon set — subset of Lucide; відсутні `BarChart2` (є `BarChart`), `ChevronUp` (є `ArrowUp`) — TypeScript ловить, але не каже яку альтернативу брати; перевіряй vendor/ui/icons.tsx перед використанням — src/vendor/ui/icons.tsx

## Session Notes

<!-- Датовані підсумки сесій -->

[2026-06-19] Severity filter bar in FindingsTab uses local state (not URL) initialized from `initialSeverity` prop; clicking an already-active badge toggles back to "all" via `prev === sev ? null : sev` — FindingsTab.tsx:49
[2026-06-24] ConventionsView follows SkillsView pattern (AppShell inside view, not page.tsx) — but AppShell depends on usePathname/useRouter/useRepos, so its view-level components cannot be tested without heavy mocking; test the ConventionRow presentational sub-export instead — src/app/repos/[repoId]/conventions/_components/ConventionsView/ConventionsView.tsx

## Open Questions

<!-- Що лишилось нез'ясованим -->
