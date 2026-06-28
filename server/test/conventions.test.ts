import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { buildConventionMarkdown } from '../src/modules/conventions/service.js';

/**
 * Hermetic conventions route tests — no DB required.
 * Validates schema enforcement (UUID params, body shape) and markdown logic.
 */
const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

describe('conventions routes (no DB)', () => {
  it('GET /repos/<non-uuid>/conventions → 422', async () => {
    const app = await buildApp({ config });
    const res = await app.inject({ method: 'GET', url: '/repos/not-a-uuid/conventions' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('validation_error');
    await app.close();
  });

  it('PATCH /repos/<uuid>/conventions/<non-uuid> → 422', async () => {
    const app = await buildApp({ config });
    const res = await app.inject({
      method: 'PATCH',
      url: '/repos/00000000-0000-0000-0000-000000000001/conventions/not-a-uuid',
      payload: { accepted: true },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('PATCH /repos/<uuid>/conventions/<uuid> with empty body → 422 (refinement: need at least one field)', async () => {
    const app = await buildApp({ config });
    const res = await app.inject({
      method: 'PATCH',
      url: '/repos/00000000-0000-0000-0000-000000000001/conventions/00000000-0000-0000-0000-000000000002',
      payload: {},
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('POST /repos/<non-uuid>/conventions/skill-preview → 422', async () => {
    const app = await buildApp({ config });
    const res = await app.inject({
      method: 'POST',
      url: '/repos/not-a-uuid/conventions/skill-preview',
      payload: {},
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('POST /repos/<uuid>/conventions/skill-preview with invalid candidate_ids → 422', async () => {
    const app = await buildApp({ config });
    const res = await app.inject({
      method: 'POST',
      url: '/repos/00000000-0000-0000-0000-000000000001/conventions/skill-preview',
      payload: { candidate_ids: ['not-a-uuid'] },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('POST /repos/<uuid>/conventions/skill with missing required fields → 422', async () => {
    const app = await buildApp({ config });
    const res = await app.inject({
      method: 'POST',
      url: '/repos/00000000-0000-0000-0000-000000000001/conventions/skill',
      payload: { name: 'test' },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('POST /repos/<uuid>/conventions/skill with invalid agent_id → 422', async () => {
    const app = await buildApp({ config });
    const res = await app.inject({
      method: 'POST',
      url: '/repos/00000000-0000-0000-0000-000000000001/conventions/skill',
      payload: {
        name: 'test',
        description: 'desc',
        type: 'convention',
        enabled: true,
        body: 'body',
        agent_id: 'not-a-uuid',
      },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });
});

describe('buildConventionMarkdown', () => {
  const now = new Date();

  const makeRow = (overrides: Partial<{
    id: string; accepted: boolean; category: string | null; rule: string;
    evidencePath: string | null; evidenceLine: number | null; evidenceSnippet: string | null;
  }>) => ({
    id: '00000000-0000-0000-0000-000000000001',
    workspaceId: 'ws',
    repoId: 'repo',
    accepted: true,
    category: 'naming',
    rule: 'Use camelCase',
    evidencePath: 'src/index.ts',
    evidenceLine: 5,
    evidenceSnippet: 'const myVar = 1;',
    confidence: 0.9,
    createdAt: now,
    ...overrides,
  });

  it('includes only accepted candidates', () => {
    const candidates = [
      makeRow({ accepted: true, rule: 'Use camelCase' }),
      makeRow({ id: '00000000-0000-0000-0000-000000000002', accepted: false, rule: 'Rejected rule' }),
    ];
    const md = buildConventionMarkdown('acme/repo', candidates);
    expect(md).toContain('Use camelCase');
    expect(md).not.toContain('Rejected rule');
  });

  it('rejected candidates do not appear in markdown body', () => {
    const candidates = [
      makeRow({ accepted: false, rule: 'Do not use var' }),
      makeRow({ accepted: false, rule: 'No any types' }),
    ];
    const md = buildConventionMarkdown('acme/repo', candidates);
    expect(md).not.toContain('Do not use var');
    expect(md).not.toContain('No any types');
    expect(md).toContain('acme/repo Conventions');
  });

  it('groups by category', () => {
    const candidates = [
      makeRow({ category: 'naming', rule: 'camelCase vars' }),
      makeRow({ id: '2', category: 'formatting', rule: 'trailing commas' }),
    ];
    const md = buildConventionMarkdown('org/repo', candidates);
    const namingIdx = md.indexOf('## naming');
    const formattingIdx = md.indexOf('## formatting');
    expect(namingIdx).toBeGreaterThan(-1);
    expect(formattingIdx).toBeGreaterThan(-1);
    expect(md).toContain('camelCase vars');
    expect(md).toContain('trailing commas');
  });

  it('null category falls back to General', () => {
    const candidates = [makeRow({ category: null, rule: 'Some rule' })];
    const md = buildConventionMarkdown('org/repo', candidates);
    expect(md).toContain('## General');
  });

  it('includes evidence file:line and snippet', () => {
    const candidates = [
      makeRow({ evidencePath: 'src/utils.ts', evidenceLine: 42, evidenceSnippet: 'const helper = ...' }),
    ];
    const md = buildConventionMarkdown('org/repo', candidates);
    expect(md).toContain('`src/utils.ts:42`');
    expect(md).toContain('const helper = ...');
  });

  it('omits evidence block when evidencePath is null', () => {
    const candidates = [makeRow({ evidencePath: null, evidenceLine: null, evidenceSnippet: null })];
    const md = buildConventionMarkdown('org/repo', candidates);
    expect(md).toContain('Use camelCase');
    expect(md).not.toContain('Evidence:');
  });

  it('repo fullName appears in heading', () => {
    const md = buildConventionMarkdown('myorg/myrepo', [makeRow({})]);
    expect(md).toContain('# myorg/myrepo Conventions');
    expect(md).toContain('Flag changes that violate these rules');
  });
});
