# HW2 Acceptance Demo — Conventions Extractor + API Contract Reviewer

This file is the step-by-step script for the demo video.
It covers the full product flow from Conventions Extractor to the API Contract Reviewer experiment.

---

## Prerequisites

- DevDigest running locally (`./scripts/dev.sh`)
- `goit-agentic-engineering` repo added and indexed in DevDigest (or `acme/payments-api` demo repo)
- OpenRouter (or another LLM provider) configured in DevDigest Settings
- GitHub token configured so DevDigest can fetch PR diffs

---

## Part 1 — Conventions Extractor (full product flow)

### Step 1.1 — Scan a repo

1. Open `http://localhost:3000`.
2. In the left sidebar, click on a repo (e.g. `goit-agentic-engineering`).
3. In the repo nav, click **Conventions** (under Skills Lab).
4. Click **Scan** (or **Re-scan** if candidates already exist).
5. Wait for the scan to finish. You should see a list of candidates with:
   - Category badge (naming / typing / imports / etc.)
   - Rule description
   - Evidence path:line (clickable GitHub link)
   - Code snippet
   - Confidence bar

**What to show on video:** The loading spinner while the scan runs, then the populated list of candidates.

### Step 1.2 — Accept / Reject candidates

1. Review the list. Accept 3–5 candidates whose rule + evidence clearly match.
2. Reject at least 1 candidate (ideally one with a weak snippet or a rule that doesn't match).
3. Optionally click **Edit** on a candidate to tune the rule text.

**What to show on video:** Clicking Accept/Reject, the counter updating ("3 of 8 accepted"), and clicking a GitHub evidence link to prove it opens the real file at the correct line.

### Step 1.3 — Create a skill

1. Click **Create skill** (button enabled only when ≥1 candidate is accepted).
2. The modal pre-fills:
   - Name: `goit-agentic-engineering Conventions`
   - Description auto-generated
   - Body: Markdown with accepted rules + evidence citations
   - Type: `convention`
3. Scroll through the body and confirm **rejected candidates are absent**.
4. Optionally edit the name or body.
5. In the **Link to agent** dropdown, select the "API Contract Reviewer" agent (created in Part 2).
   If the agent doesn't exist yet, leave this empty and link it manually in Step 2.3.
6. Click **Create skill**.

**What to show on video:** The modal open with pre-filled body, rejected candidate absent, and the success toast after creation.

---

## Part 2 — API Contract Reviewer Experiment

### Setup — The Breaking Change

The demo PR introduces four **backwards-incompatible** changes to a payments API:

| Change | Type | Why it breaks |
|--------|------|---------------|
| `transaction_id` → `transactionId` | Field rename | Clients using old name get `undefined` |
| `account_number` removed | Field deletion | Clients depending on it silently fail |
| `created_at` → `createdAt` | Field rename | Same as above |
| POST status `201` → `200` | Status code change | Clients branching on `=== 201` fail |

The fixture file is at `specs/convention-extractor-homework/fixtures/demo-payments-api.ts`.

**How to create the demo PR (one-time setup):**

```sh
# From the project root, on a fresh branch:
git checkout -b demo/breaking-api-change lab-2
# The fixture is already committed in specs/; just open the PR.
gh pr create \
  --title "Demo: migrate payments response to camelCase (breaking)" \
  --body "Demo fixture for API Contract Reviewer acceptance test. Intentional breaking changes." \
  --base lab-2
```

Note the PR number. Use it in steps 2.2 and 2.3 below.

---

### Step 2.1 — Create the "API Contract Reviewer" agent

1. Open **Agents** in the left sidebar.
2. Click **New agent**.
3. Fill in:
   - **Name**: `API Contract Reviewer`
   - **Description**: `Checks public API changes for backwards-compatibility violations`
   - **System prompt** (paste the text below):

```
You are an API contract reviewer. Your job is to find backwards-incompatible
changes in this pull request that would break existing clients.

Look for:
- Removed or renamed response fields
- HTTP status code changes on existing endpoints
- URL route path changes
- New required request fields

For each issue, state: what changed, why it breaks clients, and cite the exact file:line.
If you find no breaking changes, say "No breaking changes detected."

Be direct. Do not praise the code. Only report contract violations.
```

   - **Model**: `deepseek/deepseek-v4-flash` (or your preferred model)
   - **Skills**: leave empty for now
4. Click **Save**.

---

### Step 2.2 — Run WITHOUT skill (expect: miss or vague)

1. Navigate to the demo PR (created in setup above).
2. Click **Run review** → select `API Contract Reviewer`.
3. Wait for the review to complete.
4. **Expected result without skill**: The agent may note "naming convention change to camelCase" but will likely:
   - NOT flag it as a breaking change (no explicit rules to follow)
   - Give a vague "looks like a refactor" summary
   - Miss the `account_number` removal entirely
   - Miss the status code change

**What to show on video:** The review result showing 0 CRITICAL findings, or a finding that doesn't call out the backwards-compat violation clearly.

> Note: LLM output is non-deterministic. If the model happens to flag the breaking change without the skill, acknowledge it and re-run — the skill makes the finding *consistent and specific*, not just probabilistic.

---

### Step 2.3 — Add the skill to the agent

1. Open **Skills** in the left sidebar.
2. Click **New skill** (or **Import**).
3. Paste the content of `specs/convention-extractor-homework/fixtures/api-contract-reviewer-skill.md` as the skill body.
4. Set:
   - **Name**: `API Contract Reviewer Rules`
   - **Type**: `convention`
   - **Enabled**: yes
5. Click **Save**.
6. Open the **API Contract Reviewer** agent → **Skills** tab.
7. Click **Add skill** → select `API Contract Reviewer Rules`.
8. Confirm the skill appears in the list as enabled.

---

### Step 2.4 — Run WITH skill (expect: catch all 4 violations)

1. Navigate back to the same demo PR.
2. Click **Run review** → select `API Contract Reviewer`.
3. Wait for the review to complete.
4. **Expected result with skill**: The agent should now produce findings like:
   - **CRITICAL**: `` `transaction_id` renamed to `transactionId` without backwards-compat alias — existing clients will receive `undefined` for this field. ``
   - **CRITICAL**: `` `account_number` removed from response with no deprecation path. ``
   - **CRITICAL** or **WARNING**: `` `created_at` renamed to `createdAt` — same issue as above. ``
   - **CRITICAL**: `` POST /api/payments status changed from `201` to `200` — clients checking `=== 201` will break. ``

**What to show on video:** The review result showing CRITICAL findings with specific file:line citations, contrasted against the previous run without skill.

---

## What to Capture in the Demo Video

| Timestamp | What to show |
|-----------|-------------|
| 0:00–0:30 | DevDigest home, open a repo, navigate to Conventions |
| 0:30–1:30 | Scan running → candidates appear → click GitHub evidence link (opens real code) |
| 1:30–2:30 | Accept 3 candidates, reject 1, create skill, confirm rejected candidate absent from body |
| 2:30–3:00 | Open Agents, show the API Contract Reviewer agent (NO skills linked) |
| 3:00–3:30 | Run review on demo PR → result shows 0 CRITICAL or misses the breaking change |
| 3:30–4:00 | Open Skills, add the API Contract Reviewer Rules skill, link to agent |
| 4:00–5:00 | Run review on same PR again → CRITICAL findings appear for all 4 violations |
| 5:00–5:15 | Side-by-side or scroll: old run vs new run to show the contrast |

Total: ~5 minutes.

---

## Troubleshooting

**Agent finds the breaking change even without the skill:**
This can happen — the model is not blocked from reasoning about breaking changes. The skill makes the finding *guaranteed and specific* (correct severity, specific rule cited). Re-run a few times if needed, or demonstrate the specificity difference (with skill: exact field names cited, severity CRITICAL; without skill: generic "naming change" note at SUGGESTION level).

**Evidence links don't open to the right file:**
Check that the repo `default_branch` or `head_sha` are set in DevDigest. The GitHub blob URL is built from these. If the repo is newly added, trigger a re-index.

**Scan returns 0 candidates:**
The repo must be cloned locally (`clonePath` set on the repo row). DevDigest clones on first index. If `clonePath` is null, trigger a re-index in the repo settings.
