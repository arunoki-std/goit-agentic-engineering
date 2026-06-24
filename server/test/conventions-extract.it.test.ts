import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type { RepoIntel } from '../src/modules/repo-intel/types.js';
import type {
  IndexResult,
  IndexState,
  BlastResult,
  RepoMapResult,
} from '../src/modules/repo-intel/types.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

/**
 * Minimal RepoIntel stub: getConventionSamples returns caller-supplied paths;
 * all other methods return degraded values so they never block the test.
 */
function makeRepoIntel(samples: string[]): RepoIntel {
  const degraded: IndexResult = {
    status: 'degraded',
    filesIndexed: 0,
    filesSkipped: 0,
    durationMs: 0,
  };
  const blastDegraded: BlastResult = {
    changedSymbols: [],
    callers: [],
    impactedEndpoints: [],
    degraded: true,
    reason: 'no_data',
  };
  const mapDegraded: RepoMapResult = {
    text: '',
    tokens: 0,
    cached: false,
    degraded: true,
    reason: 'no_data',
  };
  const state: IndexState = {
    ...degraded,
    repoId: '',
    lastIndexedSha: '',
    indexerVersion: 0,
    updatedAt: new Date(),
    degraded: true,
    degradedReason: 'no_data',
  };
  return {
    indexRepo: async () => degraded,
    refreshIndex: async () => degraded,
    getIndexState: async (repoId) => ({ ...state, repoId }),
    getBlastRadius: async () => blastDegraded,
    getRepoMap: async () => mapDegraded,
    getFileRank: async () => [],
    getSymbolsInFiles: async () => [],
    getCallerSignatures: async () => [],
    getUnresolvedReferences: async () => [],
    getConventionSamples: async () => samples,
    getTopFilesByRank: async () => samples,
    getCriticalPaths: async () => [],
  };
}

/** Build a candidate fixture for MockLLMProvider. */
function candidateFixture(overrides: {
  path?: string;
  line?: number;
  confidence?: number;
  category?: string;
  rule?: string;
}) {
  return {
    candidates: [
      {
        category: overrides.category ?? 'naming',
        rule: overrides.rule ?? 'Use const for immutable bindings',
        evidence: {
          path: overrides.path ?? 'src/index.ts',
          line: overrides.line ?? 1,
        },
        confidence: overrides.confidence ?? 0.9,
      },
    ],
  };
}

d('Testcontainers: conventions extract pipeline', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoId: string;
  let cloneDir: string;

  beforeAll(async () => {
    pg = await startPg();
    const { workspaceId: wsId } = await seed(pg.handle.db);
    workspaceId = wsId;

    // Create a temp directory to act as the local clone.
    cloneDir = await mkdtemp(join(tmpdir(), 'devdigest-conventions-test-'));

    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name: 'extract-test',
        fullName: 'acme/extract-test',
        clonePath: cloneDir,
      })
      .returning();
    repoId = repo!.id;
  });

  afterAll(async () => {
    await pg?.stop();
    if (cloneDir) await rm(cloneDir, { recursive: true, force: true });
  });

  it('valid candidate is saved — file and line exist in clone', async () => {
    // Write the evidence file to the fake clone.
    await mkdir(join(cloneDir, 'src'), { recursive: true });
    await writeFile(join(cloneDir, 'src', 'index.ts'), 'const myVar = 1;\nconst other = 2;\n');

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        repoIntel: makeRepoIntel(['src/index.ts']),
        llm: {
          openrouter: new MockLLMProvider('openai', {
            structured: candidateFixture({ path: 'src/index.ts', line: 1, confidence: 0.85 }),
          }),
        },
      },
    });

    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>[];
    expect(body).toHaveLength(1);
    expect(body[0]!['evidence_path']).toBe('src/index.ts');
    expect(body[0]!['evidence_line']).toBe(1);
    expect(body[0]!['evidence_snippet']).toBe('const myVar = 1;');
    expect(body[0]!['confidence']).toBeCloseTo(0.85);
    expect(body[0]!['accepted']).toBe(false);
    await app.close();
  });

  it('non-existent evidence file is rejected — no candidates saved', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        repoIntel: makeRepoIntel([]),
        llm: {
          openrouter: new MockLLMProvider('openai', {
            structured: candidateFixture({ path: 'src/does-not-exist.ts', line: 1 }),
          }),
        },
      },
    });

    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    await app.close();
  });

  it('line out of range is rejected — candidate discarded', async () => {
    // src/index.ts has 2 lines (written in the first test above).
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        repoIntel: makeRepoIntel([]),
        llm: {
          openrouter: new MockLLMProvider('openai', {
            structured: candidateFixture({ path: 'src/index.ts', line: 999 }),
          }),
        },
      },
    });

    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    await app.close();
  });

  it('confidence is clamped to [0,1] via schema transform', async () => {
    // confidence=1.5 in the fixture → schema transform clamps to 1.0
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        repoIntel: makeRepoIntel([]),
        llm: {
          openrouter: new MockLLMProvider('openai', {
            structured: candidateFixture({ path: 'src/index.ts', line: 1, confidence: 1.5 }),
          }),
        },
      },
    });

    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>[];
    expect(body).toHaveLength(1);
    expect(body[0]!['confidence']).toBeLessThanOrEqual(1);
    await app.close();
  });

  it('re-scan replaces previous candidates — stale rows are gone', async () => {
    // Seed an old candidate directly.
    await pg.handle.db.insert(t.conventions).values({
      workspaceId,
      repoId,
      rule: 'Old stale rule',
      accepted: false,
    });

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        repoIntel: makeRepoIntel([]),
        llm: {
          openrouter: new MockLLMProvider('openai', {
            structured: candidateFixture({
              path: 'src/index.ts',
              line: 2,
              rule: 'New fresh rule',
            }),
          }),
        },
      },
    });

    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>[];
    // Only the new rule; the stale one is gone.
    expect(body.every((c) => c['rule'] !== 'Old stale rule')).toBe(true);
    expect(body.some((c) => c['rule'] === 'New fresh rule')).toBe(true);
    await app.close();
  });

  it('blank evidence line is rejected — empty line in file', async () => {
    // Line 2 of blanks.ts is intentionally empty.
    await mkdir(join(cloneDir, 'src'), { recursive: true });
    await writeFile(join(cloneDir, 'src', 'blanks.ts'), 'const a = 1;\n\nconst b = 2;\n');

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        repoIntel: makeRepoIntel([]),
        llm: {
          openrouter: new MockLLMProvider('openai', {
            structured: candidateFixture({ path: 'src/blanks.ts', line: 2 }),
          }),
        },
      },
    });

    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    await app.close();
  });

  it('whitespace-only evidence line is rejected', async () => {
    // Line 2 is spaces+tab only.
    await writeFile(join(cloneDir, 'src', 'whitespace.ts'), 'const a = 1;\n   \t  \nconst b = 2;\n');

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        repoIntel: makeRepoIntel([]),
        llm: {
          openrouter: new MockLLMProvider('openai', {
            structured: candidateFixture({ path: 'src/whitespace.ts', line: 2 }),
          }),
        },
      },
    });

    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    await app.close();
  });

  it('missing confidence in LLM response defaults to 0.6, not 1.0', async () => {
    // Fixture omits the confidence field — schema should default to 0.6.
    const fixtureWithoutConfidence = {
      candidates: [
        {
          category: 'naming',
          rule: 'Use const for immutable bindings',
          evidence: { path: 'src/index.ts', line: 1 },
          // confidence intentionally absent
        },
      ],
    };

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        repoIntel: makeRepoIntel([]),
        llm: {
          openrouter: new MockLLMProvider('openai', { structured: fixtureWithoutConfidence }),
        },
      },
    });

    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>[];
    expect(body).toHaveLength(1);
    expect(body[0]!['confidence']).toBeCloseTo(0.6);
    expect(body[0]!['confidence']).not.toBe(1.0);
    await app.close();
  });

  it('POST /repos/<uncloned-uuid>/conventions/extract → 404 when no clonePath', async () => {
    const [uncloned] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'x', name: 'uncloned', fullName: 'x/uncloned' })
      .returning();

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        repoIntel: makeRepoIntel([]),
        llm: { openrouter: new MockLLMProvider() },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/repos/${uncloned!.id}/conventions/extract`,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
