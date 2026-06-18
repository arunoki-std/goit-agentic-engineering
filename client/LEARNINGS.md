# LEARNINGS.md — client/ (@devdigest/web)

Next.js 15 App Router · TanStack Query · next-intl · recharts

Entry format: `[YYYY-MM-DD] <finding> — <file:line if applicable>`
Rules: append-only; correct with a dated note, never overwrite; terse + actionable "cold".
Prune quarterly.

---

## What Works

<!-- Підходи й рішення, що спрацювали в client/ -->

## What Doesn't Work

<!-- Глухі кути й антипатерни — найцінніша секція -->
<!-- Приклад: [2026-06-19] fetch() напряму в компоненті — ламає кеш TanStack Query; завжди через src/lib/hooks/ -->

## Codebase Patterns

<!-- Non-default конвенції client/ -->
<!-- Приклад: [2026-06-19] Сторінки тонкі — вся логіка в _components/<Name>/; не класти бізнес-логіку в page.tsx -->

## Tool & Library Notes

<!-- Квірки Next.js 15, TanStack Query, next-intl -->

## Recurring Errors & Fixes

<!-- Повторювані помилки + фікс -->
<!-- Приклад: [2026-06-19] Контракти розсинхронізувались — src/vendor/shared/ ≠ server/src/vendor/shared/ -->

## Session Notes

<!-- Датовані підсумки сесій -->

## Open Questions

<!-- Що лишилось нез'ясованим -->
