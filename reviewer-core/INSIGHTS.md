# INSIGHTS.md — reviewer-core/ (@devdigest/reviewer-core)

Pure review engine · injected LLMProvider · no I/O

Entry format: `[YYYY-MM-DD] <finding> — <file:line if applicable>`
Rules: append-only; correct with a dated note, never overwrite; terse + actionable "cold".
Prune quarterly.

---

## What Works

<!-- Підходи й рішення, що спрацювали в reviewer-core/ -->

## What Doesn't Work

<!-- Глухі кути й антипатерни — найцінніша секція -->
<!-- Приклад: [2026-06-19] Довіряти model's self-reported score — recompute з survived findings -->

## Codebase Patterns

<!-- Non-default конвенції reviewer-core/ -->
<!-- Приклад: [2026-06-19] Extra slots (skills/memory/specs) — no-ops поки їх не прокидає caller -->

## Tool & Library Notes

<!-- Квірки OpenRouter, structured output, parse-with-repair -->

## Recurring Errors & Fixes

<!-- Повторювані помилки + фікс -->
<!-- Приклад: [2026-06-19] `pnpm build` не генерує JS — це typecheck, dist/ не існує -->

## Session Notes

<!-- Датовані підсумки сесій -->

## Open Questions

<!-- Що лишилось нез'ясованим -->
