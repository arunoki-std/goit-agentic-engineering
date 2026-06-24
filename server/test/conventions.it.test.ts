import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
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

d('Testcontainers: conventions skill endpoints', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoId: string;

  beforeAll(async () => {
    pg = await startPg();
    const { workspaceId: wsId } = await seed(pg.handle.db);
    workspaceId = wsId;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'skill-test', fullName: 'acme/skill-test' })
      .returning();
    repoId = repo!.id;
  });

  afterAll(async () => {
    await pg?.stop();
  });

  it('skill-preview returns 404 when repo does not exist', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/repos/00000000-0000-0000-0000-000000000099/conventions/skill-preview',
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('skill-preview returns 422 when no accepted candidates', async () => {
    await pg.handle.db
      .insert(t.conventions)
      .values({ workspaceId, repoId, rule: 'Rejected rule', accepted: false });

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill-preview`,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('skill-preview includes only accepted candidates', async () => {
    await pg.handle.db.insert(t.conventions).values([
      {
        workspaceId,
        repoId,
        category: 'naming',
        rule: 'Use camelCase',
        evidencePath: 'src/index.ts',
        evidenceLine: 1,
        evidenceSnippet: 'const myVar = 1;',
        accepted: true,
      },
      {
        workspaceId,
        repoId,
        category: 'formatting',
        rule: 'Rejected formatting rule',
        evidencePath: 'src/other.ts',
        evidenceLine: 5,
        accepted: false,
      },
    ]);

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill-preview`,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body['type']).toBe('convention');
    expect(body['enabled']).toBe(true);
    expect(typeof body['token_count']).toBe('number');
    expect(body['body'] as string).toContain('Use camelCase');
    expect(body['body'] as string).not.toContain('Rejected formatting rule');
    await app.close();
  });

  it('create skill saves with source=extracted', async () => {
    await pg.handle.db.insert(t.conventions).values({
      workspaceId,
      repoId,
      category: 'naming',
      rule: 'No default exports',
      evidencePath: 'src/utils.ts',
      evidenceLine: 3,
      evidenceSnippet: 'export function helper() {}',
      accepted: true,
    });

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: {
        name: 'acme/skill-test Conventions',
        description: 'Convention rules extracted from acme/skill-test',
        type: 'convention',
        enabled: true,
        body: '# acme/skill-test Conventions\n\n- No default exports',
      },
    });
    expect(res.statusCode).toBe(200);
    const skill = res.json() as Record<string, unknown>;
    expect(skill['source']).toBe('extracted');
    expect(skill['type']).toBe('convention');
    expect(skill['enabled']).toBe(true);
    expect(typeof skill['id']).toBe('string');

    // Verify persisted row
    const [row] = await pg.handle.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.id, skill['id'] as string));
    expect(row!.source).toBe('extracted');
    expect(row!.evidenceFiles).toContain('src/utils.ts');
    await app.close();
  });

  it('create skill with agent_id creates agent_skill link', async () => {
    await pg.handle.db.insert(t.conventions).values({
      workspaceId,
      repoId,
      rule: 'Always use strict equality',
      evidencePath: 'src/check.ts',
      evidenceLine: 10,
      evidenceSnippet: 'if (a === b) {',
      accepted: true,
    });

    // Insert a minimal agent to link against
    const [agent] = await pg.handle.db
      .insert(t.agents)
      .values({
        workspaceId,
        name: 'test-agent',
        description: '',
        provider: 'openrouter',
        model: 'gpt-4',
        systemPrompt: 'You are a reviewer.',
      })
      .returning();

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: {
        name: 'Linked Conventions',
        description: 'desc',
        type: 'convention',
        enabled: true,
        body: '# Conventions\n\n- Always use strict equality',
        agent_id: agent!.id,
      },
    });
    expect(res.statusCode).toBe(200);
    const skill = res.json() as Record<string, unknown>;

    const links = await pg.handle.db
      .select()
      .from(t.agentSkills)
      .where(eq(t.agentSkills.agentId, agent!.id));
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((l) => l.skillId === skill['id'])).toBe(true);
    await app.close();
  });

  it('create skill with unknown agent_id returns 404', async () => {
    await pg.handle.db.insert(t.conventions).values({
      workspaceId,
      repoId,
      rule: 'Use const over let',
      evidencePath: 'src/x.ts',
      evidenceLine: 1,
      evidenceSnippet: 'const x = 1;',
      accepted: true,
    });

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: {
        name: 'test',
        description: 'desc',
        type: 'convention',
        enabled: true,
        body: '# test',
        agent_id: '00000000-0000-0000-0000-000000000099',
      },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
