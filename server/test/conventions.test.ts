import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';

/**
 * Hermetic conventions route tests — no DB required.
 * Validates schema enforcement (UUID params, body shape).
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
});
