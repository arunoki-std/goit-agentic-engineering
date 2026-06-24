import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';

/**
 * Hermetic schema tests for POST /repos/:id/conventions/extract.
 * No DB or LLM required — validates param schema enforcement only.
 */
const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

describe('conventions extract route (no DB)', () => {
  it('POST /repos/<non-uuid>/conventions/extract → 422', async () => {
    const app = await buildApp({ config });
    const res = await app.inject({
      method: 'POST',
      url: '/repos/not-a-uuid/conventions/extract',
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('validation_error');
    await app.close();
  });
});
