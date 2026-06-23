import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType, SkillSource, type CommunitySkill } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import { SkillsService } from './service.js';

const CreateSkillBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: SkillType,
  body: z.string().min(1),
  enabled: z.boolean().optional(),
});

const UpdateSkillBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: SkillType.optional(),
  body: z.string().optional(),
  enabled: z.boolean().optional(),
});

const ParseImportBody = z.object({
  body: z.string().min(1),
  name: z.string().optional(),
});

const ImportBody = z.object({
  body: z.string().min(1),
  name: z.string().optional(),
  source: SkillSource,
  description: z.string().optional(),
  type: SkillType.optional(),
});

const ImportUrlBody = z.object({
  url: z.string().url(),
});

const CommunitySearchQuery = z.object({
  q: z.string().optional(),
});

/** Static curated community skills catalog. */
const COMMUNITY_CATALOG: CommunitySkill[] = [
  {
    name: 'pr-quality-rubric',
    repo: 'devdigest/skills-catalog',
    stars: 312,
    lang: 'any',
    desc: 'Rubric for evaluating overall PR quality across correctness, tests, and clarity.',
  },
  {
    name: 'no-then-chains',
    repo: 'devdigest/skills-catalog',
    stars: 188,
    lang: 'js/ts',
    desc: 'House rule: always use async/await instead of .then() chains.',
  },
  {
    name: 'secret-leakage-gate',
    repo: 'devdigest/skills-catalog',
    stars: 274,
    lang: 'any',
    desc: 'Detects sk_live, service_role, and NEXT_PUBLIC_ keys hardcoded in diffs.',
  },
  {
    name: 'lethal-trifecta',
    repo: 'devdigest/skills-catalog',
    stars: 201,
    lang: 'any',
    desc: 'Flags PRs combining private data access + untrusted input + exfil path.',
  },
  {
    name: 'phantom-api-gate',
    repo: 'devdigest/skills-catalog',
    stars: 95,
    lang: 'any',
    desc: 'Detects imports of functions/modules that no longer exist in the codebase.',
  },
  {
    name: 'test-coverage-nudge',
    repo: 'devdigest/skills-catalog',
    stars: 143,
    lang: 'js/ts',
    desc: 'Suggests tests when new branches lack coverage.',
  },
  {
    name: 'no-raw-sql-in-service',
    repo: 'devdigest/skills-catalog',
    stars: 77,
    lang: 'any',
    desc: 'Flags raw SQL strings inside service or controller layers; queries belong in repositories.',
  },
  {
    name: 'immutable-migrations-gate',
    repo: 'devdigest/skills-catalog',
    stars: 166,
    lang: 'any',
    desc: 'Blocks edits to already-applied migration files; only additive migrations are safe.',
  },
  {
    name: 'ssrf-prevention',
    repo: 'devdigest/skills-catalog',
    stars: 231,
    lang: 'any',
    desc: 'Checks server-side fetch/axios calls for missing URL validation that could enable SSRF.',
  },
  {
    name: 'dependency-pinning',
    repo: 'devdigest/skills-catalog',
    stars: 59,
    lang: 'js/ts',
    desc: 'Flags unpinned or wildcard dependency versions in package.json changes.',
  },
];

/**
 * A1 — skills module.
 *   GET    /skills                       → list (workspace-scoped)
 *   GET    /skills/:id                   → one skill
 *   GET    /skills/:id/versions          → version history
 *   POST   /skills                       → create (manual)
 *   PUT    /skills/:id                   → update
 *   DELETE /skills/:id                   → delete
 *   POST   /skills/parse-import          → stateless preview (no DB)
 *   POST   /skills/import                → save imported skill
 *   POST   /skills/import-url            → fetch URL → preview (no DB)
 *   GET    /skills/community             → curated catalog (searchable)
 */
export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  // Static routes must be registered before /:id to avoid matching
  app.get('/skills/community', { schema: { querystring: CommunitySearchQuery } }, async (req) => {
    await getContext(app.container, req);
    const q = req.query.q?.toLowerCase();
    if (!q) return COMMUNITY_CATALOG;
    return COMMUNITY_CATALOG.filter(
      (s) =>
        s.name.includes(q) ||
        s.desc.toLowerCase().includes(q) ||
        s.lang.toLowerCase().includes(q),
    );
  });

  app.post('/skills/parse-import', { schema: { body: ParseImportBody } }, async (req) => {
    await getContext(app.container, req);
    return service.parseImport(req.body.body, req.body.name);
  });

  app.post('/skills/import', { schema: { body: ImportBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.importSkill(workspaceId, req.body);
    reply.status(201);
    return skill;
  });

  app.post('/skills/import-url', { schema: { body: ImportUrlBody } }, async (req) => {
    await getContext(app.container, req);
    try {
      return await service.fetchAndParseUrl(req.body.url);
    } catch (err) {
      const msg = (err as Error).message;
      throw new AppError('import_url_failed', msg, 400);
    }
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const versions = await service.listVersions(workspaceId, req.params.id);
    if (!versions) throw new NotFoundError('Skill not found');
    return versions;
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.create(workspaceId, {
      name: req.body.name,
      description: req.body.description,
      type: req.body.type,
      body: req.body.body,
      enabled: req.body.enabled,
    });
    reply.status(201);
    return skill;
  });

  app.put('/skills/:id', { schema: { params: IdParams, body: UpdateSkillBody } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.update(workspaceId, req.params.id, req.body);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const ok = await service.delete(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Skill not found');
    return { ok: true };
  });
}
