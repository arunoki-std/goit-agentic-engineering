/**
 * seed-demo — rich demo data for testing the findings-severity-counters feature.
 *
 * Creates 4 PRs with varied finding distributions so every UI state is visible:
 *   #482  2 review runs  → CRITICAL + WARNING + SUGGESTION in the filter bar
 *   #479  1 review run   → WARNING + SUGGESTION only
 *   #477  clean review   → 0 findings (dimmed badges on list, no filter bar)
 *   #460  no review      → "—" on list (null findings_summary)
 *
 * NOT idempotent by design — wipes existing demo reviews/findings each run so
 * you always get a clean, predictable state for testing.
 *
 * Usage:  pnpm db:seed:demo
 * Prereq: pnpm db:seed  (workspace + repo + agents must already exist)
 */
import 'dotenv/config';
import { eq, and, inArray } from 'drizzle-orm';
import { createDb } from './client.js';
import * as t from './schema.js';
import { DEFAULT_WORKSPACE_NAME } from './seed.js';

async function seedDemo() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const handle = createDb(url);
  const db = handle.db;

  // ── resolve workspace ──────────────────────────────────────────────────────
  const [ws] = await db
    .select()
    .from(t.workspaces)
    .where(eq(t.workspaces.name, DEFAULT_WORKSPACE_NAME));
  if (!ws) {
    console.error('Default workspace not found — run `pnpm db:seed` first.');
    await handle.close();
    process.exit(1);
  }
  const workspaceId = ws.id;

  // ── resolve repo ───────────────────────────────────────────────────────────
  const [repo] = await db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, 'acme/payments-api')));
  if (!repo) {
    console.error('Demo repo not found — run `pnpm db:seed` first.');
    await handle.close();
    process.exit(1);
  }
  const repoId = repo.id;

  // ── helpers ────────────────────────────────────────────────────────────────
  async function upsertPr(pr: {
    number: number;
    title: string;
    author: string;
    branch: string;
    additions: number;
    deletions: number;
    filesCount: number;
    status: string;
  }) {
    const [existing] = await db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, pr.number)));
    if (existing) return existing;
    const [row] = await db
      .insert(t.pullRequests)
      .values({ workspaceId, repoId, headSha: 'demo', base: 'main', body: null, ...pr })
      .returning();
    return row!;
  }

  async function wipeDemoData(prId: string) {
    // Delete reviews (cascades to findings) and agent_runs for this PR.
    await db.delete(t.reviews).where(eq(t.reviews.prId, prId));
    await db.delete(t.agentRuns).where(eq(t.agentRuns.prId, prId));
  }

  // ── PR #482: Add rate limiting (2 review runs) ─────────────────────────────
  const pr482 = await upsertPr({
    number: 482,
    title: 'Add rate limiting to public API endpoints',
    author: 'marisa.koch',
    branch: 'feat/rate-limit-public',
    additions: 247,
    deletions: 38,
    filesCount: 9,
    status: 'needs_review',
  });
  await wipeDemoData(pr482.id);

  // Run 1 — General Reviewer: CRITICAL + WARNING
  const [run482a] = await db
    .insert(t.agentRuns)
    .values({
      workspaceId,
      prId: pr482.id,
      status: 'done',
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash',
      tokensIn: 9119,
      tokensOut: 1240,
      findingsCount: 2,
      score: 61,
    })
    .returning();
  const [rev482a] = await db
    .insert(t.reviews)
    .values({
      workspaceId,
      prId: pr482.id,
      runId: run482a!.id,
      kind: 'review',
      agentId: null,
      verdict: 'request_changes',
      summary:
        'Solid middleware approach, but a Stripe secret key is committed in plaintext and the user-list endpoint introduces an N+1 query under the new limiter.',
      score: 61,
      model: 'deepseek/deepseek-v4-flash',
    })
    .returning();
  await db.insert(t.findings).values([
    {
      reviewId: rev482a!.id,
      file: 'src/config.ts',
      startLine: 12,
      endLine: 12,
      severity: 'CRITICAL',
      category: 'security',
      title: 'Hardcoded Stripe secret key in commit',
      rationale:
        'Line 12 contains a literal `sk_live_` string. Committing live credentials exposes them to anyone with repo access and leaves them in git history permanently.',
      suggestion: 'Remove the key, rotate it immediately in Stripe dashboard, and load it from an env var or secrets manager.',
      confidence: 0.98,
      kind: 'secret_leak',
    },
    {
      reviewId: rev482a!.id,
      file: 'src/api/users.ts',
      startLine: 45,
      endLine: 52,
      severity: 'WARNING',
      category: 'perf',
      title: 'N+1 query in user list endpoint',
      rationale:
        'The loop on line 46 calls `db.posts.findMany({ userId })` once per user. For a user list of N items this creates N+1 queries.',
      suggestion: 'Fetch all posts in a single `IN` query and group in memory.',
      confidence: 0.86,
    },
  ]);

  // Run 2 — Security Reviewer: 2 CRITICAL + 1 SUGGESTION
  const [run482b] = await db
    .insert(t.agentRuns)
    .values({
      workspaceId,
      prId: pr482.id,
      status: 'done',
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash',
      tokensIn: 12011,
      tokensOut: 1830,
      findingsCount: 3,
      score: 38,
    })
    .returning();
  const [rev482b] = await db
    .insert(t.reviews)
    .values({
      workspaceId,
      prId: pr482.id,
      runId: run482b!.id,
      kind: 'review',
      agentId: null,
      verdict: 'request_changes',
      summary:
        'Two critical security issues: a committed secret and an SSRF-capable webhook handler. The rate-limit constant also needs a named export.',
      score: 38,
      model: 'deepseek/deepseek-v4-flash',
    })
    .returning();
  await db.insert(t.findings).values([
    {
      reviewId: rev482b!.id,
      file: 'src/config.ts',
      startLine: 12,
      endLine: 12,
      severity: 'CRITICAL',
      category: 'security',
      title: 'Hardcoded Stripe secret key in commit',
      rationale: 'A live `sk_live_` key appears verbatim on line 12 of src/config.ts.',
      suggestion: 'Rotate the key and inject via environment variable.',
      confidence: 0.97,
      kind: 'secret_leak',
    },
    {
      reviewId: rev482b!.id,
      file: 'src/api/public/webhooks.ts',
      startLine: 61,
      endLine: 74,
      severity: 'CRITICAL',
      category: 'security',
      title: 'Lethal trifecta: untrusted input reaches exfil path',
      rationale:
        'The webhook handler reads attacker-controlled `req.body.callback_url`, loads account data from the DB, then issues an outbound HTTP request to that URL — a classic SSRF + data-exfiltration trifecta.',
      suggestion: 'Allowlist outbound domains or strip `callback_url` from public webhook payloads.',
      confidence: 0.79,
      kind: 'lethal_trifecta',
    },
    {
      reviewId: rev482b!.id,
      file: 'src/middleware/ratelimit.ts',
      startLine: 28,
      endLine: 28,
      severity: 'SUGGESTION',
      category: 'style',
      title: 'Extract magic number 3600',
      rationale:
        'The number `3600` appears twice without explanation. A reader has to infer it means seconds-in-an-hour.',
      suggestion: "Replace with `const SECONDS_PER_HOUR = 3600;` at the top of the file.",
      confidence: 0.62,
    },
  ]);

  console.log('✓ PR #482 — 2 runs (General + Security), 5 findings');

  // ── PR #479: Migrate sessions to UUID (1 run: WARNING + SUGGESTION) ─────────
  const pr479 = await upsertPr({
    number: 479,
    title: 'Migrate sessions table to UUID primary key',
    author: 'deepak.r',
    branch: 'refactor/sessions-uuid',
    additions: 1240,
    deletions: 310,
    filesCount: 14,
    status: 'needs_review',
  });
  await wipeDemoData(pr479.id);

  const [run479] = await db
    .insert(t.agentRuns)
    .values({
      workspaceId,
      prId: pr479.id,
      status: 'done',
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash',
      tokensIn: 18402,
      tokensOut: 2100,
      findingsCount: 3,
      score: 73,
    })
    .returning();
  const [rev479] = await db
    .insert(t.reviews)
    .values({
      workspaceId,
      prId: pr479.id,
      runId: run479!.id,
      kind: 'review',
      agentId: null,
      verdict: 'comment',
      summary:
        'Migration logic is correct. One missing index on the foreign key will cause full scans; a few logging calls also block the hot path.',
      score: 73,
      model: 'deepseek/deepseek-v4-flash',
    })
    .returning();
  await db.insert(t.findings).values([
    {
      reviewId: rev479!.id,
      file: 'db/migrations/0042_sessions_uuid.sql',
      startLine: 18,
      endLine: 18,
      severity: 'WARNING',
      category: 'perf',
      title: 'Missing index on sessions.user_id after UUID migration',
      rationale:
        'The migration drops and recreates the sessions table but does not add an index on `user_id`. Without it, every session lookup by user performs a sequential scan.',
      suggestion: 'Add `CREATE INDEX CONCURRENTLY idx_sessions_user_id ON sessions(user_id);` at the end of the migration.',
      confidence: 0.91,
    },
    {
      reviewId: rev479!.id,
      file: 'src/auth/session.ts',
      startLine: 34,
      endLine: 34,
      severity: 'SUGGESTION',
      category: 'perf',
      title: 'Synchronous JSON.stringify inside request handler',
      rationale:
        '`JSON.stringify(session)` on line 34 blocks the event loop on large session objects.',
      suggestion: 'Move serialization off the hot path or use a streaming serializer.',
      confidence: 0.71,
    },
    {
      reviewId: rev479!.id,
      file: 'src/auth/session.ts',
      startLine: 58,
      endLine: 60,
      severity: 'SUGGESTION',
      category: 'style',
      title: 'Redundant try/catch swallows the error silently',
      rationale:
        'The catch block on line 59 logs nothing and returns `null`, hiding failures from the caller.',
      suggestion: 'Re-throw or at minimum log the error with a stack trace.',
      confidence: 0.68,
    },
  ]);

  console.log('✓ PR #479 — 1 run (Performance), 3 findings');

  // ── PR #477: Fix flaky test (clean review, 0 findings) ─────────────────────
  const pr477 = await upsertPr({
    number: 477,
    title: 'Fix flaky checkout integration test',
    author: 'tomek.w',
    branch: 'fix/flaky-checkout-test',
    additions: 42,
    deletions: 11,
    filesCount: 2,
    status: 'reviewed',
  });
  await wipeDemoData(pr477.id);

  const [run477] = await db
    .insert(t.agentRuns)
    .values({
      workspaceId,
      prId: pr477.id,
      status: 'done',
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash',
      tokensIn: 4210,
      tokensOut: 620,
      findingsCount: 0,
      score: 92,
    })
    .returning();
  await db
    .insert(t.reviews)
    .values({
      workspaceId,
      prId: pr477.id,
      runId: run477!.id,
      kind: 'review',
      agentId: null,
      verdict: 'approve',
      summary: 'Clean fix. The timing-dependent assertion is correctly replaced with an explicit wait.',
      score: 92,
      model: 'deepseek/deepseek-v4-flash',
    });

  console.log('✓ PR #477 — 1 run (clean), 0 findings → dimmed badges on list');

  // ── PR #460: Bump node (no review) ─────────────────────────────────────────
  const pr460 = await upsertPr({
    number: 460,
    title: 'Bump node 18 → 20 in CI',
    author: 'deepak.r',
    branch: 'chore/node-20',
    additions: 18,
    deletions: 4,
    filesCount: 3,
    status: 'needs_review',
  });
  await wipeDemoData(pr460.id);

  console.log('✓ PR #460 — no review → "—" on list');

  await handle.close();
  console.log('\nDemo seed complete. Open http://localhost:3000 to see the results.');
}

seedDemo().catch((err) => {
  console.error('✗ seed-demo failed:', err);
  process.exit(1);
});
