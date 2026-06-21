---
name: engineering-insights
description: Append non-obvious engineering findings discovered during a work session to the relevant module's INSIGHTS.md. Use after completing a non-trivial task in server/, client/, reviewer-core/, e2e/, or at the project root.
allowed-tools: Read, Edit, Bash(date:*)
---

# Engineering Insights

Append one or more findings to the correct `INSIGHTS.md` file for the module where the current work happened.

## Step 1 — Determine the target INSIGHTS.md

Identify the module from the files you worked on during this session:

| Worked in… | Target file |
|------------|-------------|
| `server/` | `server/INSIGHTS.md` |
| `client/` | `client/INSIGHTS.md` |
| `reviewer-core/` | `reviewer-core/INSIGHTS.md` |
| `e2e/` | `e2e/INSIGHTS.md` |
| multiple modules / project-wide | `INSIGHTS.md` (root) |

If the user explicitly named a different module, use that target.

## Step 2 — Apply the anti-banality filter

For each candidate insight, ask: **"Would this be obvious to anyone reading the code?"**

- If **yes** → discard it. Do not write it.
- If **no** → keep it. Examples of things worth writing:
  - A hidden constraint or invariant not visible in the code
  - A gotcha that bit you (not something the compiler/linter catches)
  - A measured fact (timeout, batch size, rate limit)
  - A non-obvious dependency between two files/modules
  - A workaround for a specific bug in a library

## Step 3 — Classify each insight into a section

Read the target `INSIGHTS.md` to find the correct section heading:

- **What Works** — approaches and solutions that proved correct
- **What Doesn't Work** — dead ends, anti-patterns, things that silently break
- **Codebase Patterns** — non-default conventions specific to this module
- **Tool & Library Notes** — quirks of Fastify, Drizzle, pgvector, Next.js, testcontainers, etc.
- **Recurring Errors & Fixes** — error messages and their verified fixes

When in doubt, prefer **What Doesn't Work** — it has the highest signal-to-noise ratio.

## Step 4 — Format entries

Get the current date:
```sh
date +%Y-%m-%d
```

Each entry must follow this format exactly (one line):
```
[YYYY-MM-DD] <finding> — <file:line if applicable>
```

Rules:
- Terse and actionable when read cold — no context assumed
- Mention the file and line number when the finding is tied to a specific location
- No multi-line entries; pack everything into one sentence
- Append-only: add new dated entries; correct past entries with a new dated note, never overwrite

## Step 5 — Append to the file

Read the target `INSIGHTS.md`.

Find the matching section heading (e.g. `## What Doesn't Work`).
Append the entry on a new line after the last existing entry in that section (before the next `##` heading or end of file).
Do not remove the HTML comment placeholders — append after them.

Write the updated file using Edit.

## Step 6 — Confirm

Report to the user:
- Which file was updated
- Which section(s) received new entries
- The entries that were written (verbatim)
- Any candidates that were discarded and why (banality filter)

---

## Quick reference — INSIGHTS.md locations

```
INSIGHTS.md                  ← cross-cutting / project-wide
server/INSIGHTS.md           ← @devdigest/api (Fastify · Drizzle · Postgres)
client/INSIGHTS.md           ← @devdigest/web (Next.js · TanStack Query)
reviewer-core/INSIGHTS.md    ← @devdigest/reviewer-core (pure engine)
e2e/INSIGHTS.md              ← @devdigest/e2e (agent-browser flows)
```
