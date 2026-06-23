import 'dotenv/config';
import { createDb, type Db } from './client.js';
import * as t from './schema.js';
import { eq, and } from 'drizzle-orm';
import {
  GENERAL_REVIEWER_PROMPT,
  SECURITY_REVIEWER_PROMPT,
  PERFORMANCE_REVIEWER_PROMPT,
} from './seed-prompts.js';

/** Default provider/model for the built-in reviewer agents. */
const DEFAULT_PROVIDER = 'openrouter' as const;
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

/**
 * Seed the starter's demo data. Idempotent: re-running upserts the default
 * workspace/user and the demo fixtures.
 *
 * Seeds: default workspace + system user + membership, default settings,
 * demo repo (acme/payments-api), PR #482 with files/commits, a sample review
 * with a few findings, and the three built-in agents (General + Security +
 * Performance), all on the default openrouter/deepseek-v4-flash provider+model.
 *
 * Course lessons populate the other tables (skills, conventions, memory, eval,
 * …) once their features are built — they start empty here.
 */

export const DEFAULT_WORKSPACE_NAME = 'default';
export const SYSTEM_USER_EMAIL = 'you@local';

export async function seed(db: Db): Promise<{ workspaceId: string; userId: string }> {
  // ---- workspace + user (no-auth defaults) ----
  let [ws] = await db
    .select()
    .from(t.workspaces)
    .where(eq(t.workspaces.name, DEFAULT_WORKSPACE_NAME));
  if (!ws) {
    [ws] = await db
      .insert(t.workspaces)
      .values({ name: DEFAULT_WORKSPACE_NAME })
      .returning();
  }
  const workspaceId = ws!.id;

  let [user] = await db.select().from(t.users).where(eq(t.users.email, SYSTEM_USER_EMAIL));
  if (!user) {
    [user] = await db
      .insert(t.users)
      .values({ email: SYSTEM_USER_EMAIL, name: 'You' })
      .returning();
  }
  const userId = user!.id;

  await db
    .insert(t.workspaceMembers)
    .values({ workspaceId, userId, role: 'owner' })
    .onConflictDoNothing();

  // ---- default settings ----
  const defaultSettings: Record<string, unknown> = {
    polling_interval_min: 5,
    theme: 'dark',
    density: 'regular',
    sync_to_folder: true,
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db
      .insert(t.settings)
      .values({ workspaceId, userId, key, value })
      .onConflictDoNothing();
  }

  // ---- demo repo (acme/payments-api) ----
  let [repo] = await db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, 'acme/payments-api')));
  if (!repo) {
    [repo] = await db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name: 'payments-api',
        fullName: 'acme/payments-api',
        defaultBranch: 'main',
        clonePath: null,
        createdBy: userId,
      })
      .returning();
  }
  const repoId = repo!.id;

  // ---- PR #482 (rate limiting) ----
  let [pr] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 482)));
  if (!pr) {
    [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 482,
        title: 'Add rate limiting to public API endpoints',
        author: 'marisa.koch',
        branch: 'feat/rate-limit-public',
        base: 'main',
        headSha: 'a1b2c3d4e5f6',
        additions: 247,
        deletions: 38,
        filesCount: 9,
        status: 'needs_review',
        body: 'Add rate limiting to public API endpoints to prevent abuse from unauthenticated clients.',
      })
      .returning();

    // pr_files (subset)
    await db.insert(t.prFiles).values([
      { prId: pr!.id, path: 'src/middleware/ratelimit.ts', additions: 84, deletions: 0 },
      { prId: pr!.id, path: 'src/api/public/webhooks.ts', additions: 31, deletions: 6 },
      { prId: pr!.id, path: 'src/config.ts', additions: 4, deletions: 0 },
      { prId: pr!.id, path: 'src/api/users.ts', additions: 7, deletions: 2 },
    ]);

    // pr_commits
    await db.insert(t.prCommits).values({
      prId: pr!.id,
      sha: 'a1b2c3d4e5f6',
      message: 'Add token-bucket rate limiter',
      author: 'marisa.koch',
    });

    // a sample review + findings so the PR shows results before the first run
    const [review] = await db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: pr!.id,
        kind: 'review',
        verdict: 'request_changes',
        summary:
          'Solid middleware approach, but a Stripe secret key is committed in plaintext and the user-list endpoint introduces an N+1 query under the new limiter.',
        score: 61,
        model: 'seed',
      })
      .returning();

    await db.insert(t.findings).values([
      {
        reviewId: review!.id,
        file: 'src/config.ts',
        startLine: 12,
        endLine: 12,
        severity: 'CRITICAL',
        category: 'security',
        title: 'Hardcoded Stripe secret key in commit',
        rationale: 'Line 12 contains a literal `sk_live_` Stripe secret key.',
        suggestion: 'Move to env var and rotate the key immediately.',
        confidence: 0.98,
      },
      {
        reviewId: review!.id,
        file: 'src/api/users.ts',
        startLine: 45,
        endLine: 52,
        severity: 'WARNING',
        category: 'perf',
        title: 'N+1 query in user list endpoint',
        rationale: 'Loop issues one query per user → N+1.',
        suggestion: 'Use a single IN query and group in memory.',
        confidence: 0.86,
      },
    ]);
  }

  // ---- built-in agents (the three starter presets) ----
  // Prompt bodies live in ./seed-prompts.ts (mirrored in docs/agent-prompts/*.md).
  const seedAgents: Array<typeof t.agents.$inferInsert> = [
    {
      workspaceId,
      name: 'General Reviewer',
      description: 'Reviews a PR diff for bugs, correctness, and clarity.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: GENERAL_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Security Reviewer',
      description: 'Flags secrets, injection, SSRF and the lethal trifecta before merge.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: SECURITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Performance Reviewer',
      description: 'Catches N+1 queries, missing indexes, and hot-path allocations.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: PERFORMANCE_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
  ];
  for (const a of seedAgents) {
    const [existing] = await db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, a.name)));
    if (!existing) await db.insert(t.agents).values(a);
  }

  // ---- skills + Test Quality Reviewer agent ----
  const seedSkills: Array<typeof t.skills.$inferInsert & { _name: string }> = [
    {
      _name: 'test-branch-coverage',
      workspaceId,
      name: 'test-branch-coverage',
      description: 'Checks that new branches and conditions have corresponding test assertions.',
      type: 'rubric',
      source: 'manual',
      enabled: true,
      version: 1,
      body: `# Test Branch Coverage

For every new conditional branch introduced in this diff (if/else, switch cases, ternary,
early returns, try/catch, loops), verify that at least one test assertion exercises that branch.

Flag:
- A new code path that has zero test coverage.
- Tests that only exercise the happy path when the diff clearly introduces an error case.

Report as: SEVERITY WARNING, category "test-quality".
Cite the uncovered branch at file:line and name the missing scenario.`,
    },
    {
      _name: 'no-excessive-mocking',
      workspaceId,
      name: 'no-excessive-mocking',
      description: 'Flags when the majority of a test\'s setup is mocking internals rather than behavior.',
      type: 'convention',
      source: 'manual',
      enabled: true,
      version: 1,
      body: `# No Excessive Mocking

A test that mocks more than 50% of its collaborators tests the mock configuration,
not the real behavior. Flag tests where:

- More than half the arrange phase is setting up mocks.
- Internal implementation details (private methods, internal modules) are mocked instead of
  real inputs/outputs.
- A mock is set up but never asserted on (zombie mock).

Suggest replacing with a real call, an in-memory stub, or a restructure that tests observable output.
Report as: SEVERITY INFO, category "test-quality".`,
    },
    {
      _name: 'corner-cases-required',
      workspaceId,
      name: 'corner-cases-required',
      description: 'Checks that null, empty, and boundary inputs are covered in test assertions.',
      type: 'rubric',
      source: 'manual',
      enabled: true,
      version: 1,
      body: `# Corner Cases Required

For every function or method modified in this diff, verify that the test suite covers:

- null / undefined inputs where the type allows.
- Empty collection ([], {}, "") where the type allows.
- Boundary values: 0, -1, MAX, empty string, whitespace-only strings.
- Invalid types (if runtime validation is the responsibility of the unit).

Flag any function where only "normal" inputs appear in assertions.
Report as: SEVERITY WARNING, category "test-quality".`,
    },
    {
      _name: 'no-flaky-patterns',
      workspaceId,
      name: 'no-flaky-patterns',
      description: 'Flags setTimeout, fixed sleeps, and ordering-dependent assertions that cause flaky tests.',
      type: 'convention',
      source: 'manual',
      enabled: true,
      version: 1,
      body: `# No Flaky Test Patterns

Flag any of the following patterns in test code introduced by this diff:

- \`setTimeout\`, \`setInterval\`, or \`sleep\` / \`delay\` used to wait for async operations
  instead of \`await\` or proper synchronization.
- Assertions that depend on insertion order from a collection that has no guaranteed order
  (e.g., asserting index 0 of a Set or object keys).
- Snapshot tests that include timestamps, UUIDs, or other volatile values.
- Tests that share mutable state across \`it\` blocks without reset.

Report as: SEVERITY WARNING, category "test-quality".
Suggest the deterministic alternative.`,
    },
  ];

  const skillIdMap = new Map<string, string>();
  for (const { _name, ...skill } of seedSkills) {
    let [existing] = await db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, skill.name)));
    if (!existing) {
      [existing] = await db.insert(t.skills).values(skill).returning();
      // snapshot version 1
      await db
        .insert(t.skillVersions)
        .values({ skillId: existing!.id, version: 1, body: skill.body })
        .onConflictDoNothing();
    }
    skillIdMap.set(_name, existing!.id);
  }

  // Test Quality Reviewer agent linked to all 4 skills
  const TQR_NAME = 'Test Quality Reviewer';
  let [tqrAgent] = await db
    .select()
    .from(t.agents)
    .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, TQR_NAME)));
  if (!tqrAgent) {
    [tqrAgent] = await db
      .insert(t.agents)
      .values({
        workspaceId,
        name: TQR_NAME,
        description: 'Checks test quality: branch coverage, corner cases, excessive mocking, and flaky patterns.',
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        systemPrompt:
          'You are a test quality reviewer. Examine only the test files in this diff. ' +
          'Flag uncovered branches, missing corner cases, excessive mocking, and flaky patterns. ' +
          'Return at most 5 findings ranked by severity. Cite exact file:line.',
        enabled: true,
        version: 1,
        createdBy: userId,
      })
      .returning();
  }

  // Link all 4 skills to the TQR agent (idempotent)
  const skillOrder = ['test-branch-coverage', 'no-excessive-mocking', 'corner-cases-required', 'no-flaky-patterns'];
  for (let i = 0; i < skillOrder.length; i++) {
    const skillId = skillIdMap.get(skillOrder[i]!);
    if (skillId && tqrAgent) {
      await db
        .insert(t.agentSkills)
        .values({ agentId: tqrAgent.id, skillId, order: i })
        .onConflictDoNothing();
    }
  }

  return { workspaceId, userId };
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const handle = createDb(url);
  seed(handle.db)
    .then(async (r) => {
      console.log('✓ seeded', r);
      await handle.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('✗ seed failed:', err);
      await handle.close();
      process.exit(1);
    });
}
