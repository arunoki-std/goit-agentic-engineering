import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

d('Testcontainers: conventions module', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoId: string;

  beforeAll(async () => {
    pg = await startPg();
    const { workspaceId: wsId } = await seed(pg.handle.db);
    workspaceId = wsId;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'conventions-test', fullName: 'acme/conventions-test' })
      .returning();
    repoId = repo!.id;
  });

  afterAll(async () => {
    await pg?.stop();
  });

  it('GET /repos/:id/conventions returns empty array when no conventions exist', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const res = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    await app.close();
  });

  it('GET /repos/:id/conventions returns seeded rows with correct fields', async () => {
    const [row] = await pg.handle.db
      .insert(t.conventions)
      .values({
        workspaceId,
        repoId,
        category: 'naming',
        rule: 'Use camelCase for variables',
        evidencePath: 'src/index.ts',
        evidenceLine: 12,
        evidenceSnippet: 'const myVar = 1;',
        confidence: 0.9,
        accepted: false,
      })
      .returning();

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const res = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>[];
    const found = body.find((c) => c['id'] === row!.id);
    expect(found).toBeDefined();
    expect(found!['category']).toBe('naming');
    expect(found!['evidence_line']).toBe(12);
    expect(found!['accepted']).toBe(false);
    await app.close();
  });

  it('PATCH /repos/:id/conventions/:conventionId updates accepted', async () => {
    const [row] = await pg.handle.db
      .insert(t.conventions)
      .values({ workspaceId, repoId, rule: 'No default exports', accepted: false })
      .returning();

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/repos/${repoId}/conventions/${row!.id}`,
      payload: { accepted: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accepted).toBe(true);
    await app.close();
  });

  it('PATCH /repos/:id/conventions/:conventionId updates rule', async () => {
    const [row] = await pg.handle.db
      .insert(t.conventions)
      .values({ workspaceId, repoId, rule: 'Original rule', accepted: false })
      .returning();

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/repos/${repoId}/conventions/${row!.id}`,
      payload: { rule: 'Updated rule' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rule).toBe('Updated rule');
    await app.close();
  });

  it('PATCH with unknown conventionId → 404', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/repos/${repoId}/conventions/00000000-0000-0000-0000-000000000099`,
      payload: { accepted: true },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('PATCH with convention from different workspace → 404 (workspace isolation)', async () => {
    // Insert convention under a different workspace ID
    const [otherWs] = await pg.handle.db
      .insert(t.workspaces)
      .values({ name: 'other-ws' })
      .returning();
    const [otherRepo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId: otherWs!.id, owner: 'other', name: 'repo', fullName: 'other/repo' })
      .returning();
    const [row] = await pg.handle.db
      .insert(t.conventions)
      .values({ workspaceId: otherWs!.id, repoId: otherRepo!.id, rule: 'Private rule', accepted: false })
      .returning();

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    // Request targets our repoId but points to other workspace's convention
    const res = await app.inject({
      method: 'PATCH',
      url: `/repos/${repoId}/conventions/${row!.id}`,
      payload: { accepted: true },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
