import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { diversifyPaths } from '../src/modules/conventions/service.js';

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

describe('diversifyPaths', () => {
  it('returns paths unchanged when fewer than n', () => {
    const paths = ['src/a.ts', 'src/b.ts'];
    expect(diversifyPaths(paths, 12)).toEqual(paths);
  });

  it('returns paths unchanged when exactly n', () => {
    const paths = Array.from({ length: 5 }, (_, i) => `src/group${i}/file.ts`);
    expect(diversifyPaths(paths, 5)).toEqual(paths);
  });

  it('falls back to rank order when all paths are in one group', () => {
    const paths = Array.from({ length: 20 }, (_, i) => `src/platform/file${i}.ts`);
    const result = diversifyPaths(paths, 5);
    expect(result).toHaveLength(5);
    expect(result).toEqual(paths.slice(0, 5));
  });

  it('round-robins across 2 groups — first from each, then second from each', () => {
    const paths = [
      'src/platform/container.ts',
      'src/platform/errors.ts',
      'src/platform/logger.ts',
      'src/modules/reviews/service.ts',
      'src/modules/reviews/routes.ts',
    ];
    const result = diversifyPaths(paths, 4);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe('src/platform/container.ts');
    expect(result[1]).toBe('src/modules/reviews/service.ts');
    expect(result[2]).toBe('src/platform/errors.ts');
    expect(result[3]).toBe('src/modules/reviews/routes.ts');
  });

  it('distributes across 3 groups in round-robin order', () => {
    const paths = [
      'src/platform/container.ts',
      'src/adapters/llm/openai.ts',
      'src/modules/reviews/service.ts',
      'src/platform/errors.ts',
      'src/adapters/llm/anthropic.ts',
      'src/modules/reviews/routes.ts',
    ];
    // 6 paths, n=4: round 1 picks one from each of the 3 groups (3 items),
    // round 2 picks next from each until n reached.
    const result = diversifyPaths(paths, 4);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe('src/platform/container.ts');
    expect(result[1]).toBe('src/adapters/llm/openai.ts');
    expect(result[2]).toBe('src/modules/reviews/service.ts');
    expect(result[3]).toBe('src/platform/errors.ts');
  });

  it('small group exhausts without crashing; larger groups fill remaining slots', () => {
    const paths = [
      'src/platform/container.ts',
      'src/platform/errors.ts',
      'src/platform/logger.ts',
      'src/platform/config.ts',
      'src/modules/reviews/service.ts', // only file in this group
    ];
    const result = diversifyPaths(paths, 4);
    expect(result).toHaveLength(4);
    expect(result).toContain('src/modules/reviews/service.ts');
    expect(result).toContain('src/platform/container.ts');
  });

  it('deep paths (4+ segments) collapse to 3-segment group key', () => {
    const paths = [
      'src/adapters/llm/providers/openai/client.ts',   // group: src/adapters/llm
      'src/adapters/llm/providers/anthropic/client.ts', // group: src/adapters/llm
      'src/modules/reviews/service.ts',                 // group: src/modules/reviews
    ];
    const result = diversifyPaths(paths, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('src/adapters/llm/providers/openai/client.ts');
    expect(result[1]).toBe('src/modules/reviews/service.ts');
  });

  it('root-level files get group "root" and are interleaved with dir files', () => {
    const paths = [
      'index.ts',     // group: root
      'server.ts',    // group: root
      'src/app.ts',   // group: src
    ];
    const result = diversifyPaths(paths, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('index.ts');
    expect(result[1]).toBe('src/app.ts');
  });
});
