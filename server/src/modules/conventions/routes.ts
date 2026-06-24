import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { NotFoundError } from '../../platform/errors.js';
import { AgentsService } from '../agents/service.js';
import { ConventionsService } from './service.js';

const RepoParams = z.object({ id: z.string().uuid() });

const ConventionParams = z.object({
  id: z.string().uuid(),
  conventionId: z.string().uuid(),
});

const PatchBody = z
  .object({
    accepted: z.boolean().optional(),
    rule: z.string().min(1).optional(),
  })
  .refine((b) => b.accepted !== undefined || b.rule !== undefined, {
    message: 'At least one of accepted or rule must be provided',
  });

const SkillPreviewBody = z.object({
  candidate_ids: z.array(z.string().uuid()).optional(),
});

const CreateConventionSkillBody = z.object({
  name: z.string().min(1),
  description: z.string(),
  type: SkillType,
  enabled: z.boolean(),
  body: z.string().min(1),
  agent_id: z.string().uuid().optional(),
});

/**
 * Conventions module.
 *   GET  /repos/:id/conventions                      → list candidates (workspace-scoped)
 *   POST /repos/:id/conventions/extract              → run LLM extraction scan
 *   PATCH /repos/:id/conventions/:conventionId       → update accepted / rule
 *
 * Static routes (extract) are registered before parameterised ones (:conventionId)
 * so Fastify's radix tree routes them correctly.
 */
export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  app.get('/repos/:id/conventions', { schema: { params: RepoParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.id);
  });

  // Static segment 'extract' must be registered before :conventionId wildcard.
  app.post('/repos/:id/conventions/extract', { schema: { params: RepoParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.extract(workspaceId, req.params.id);
  });

  app.post(
    '/repos/:id/conventions/skill-preview',
    { schema: { params: RepoParams, body: SkillPreviewBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.previewSkill(workspaceId, req.params.id, req.body.candidate_ids);
    },
  );

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: RepoParams, body: CreateConventionSkillBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { agent_id, ...skillInput } = req.body;
      const skill = await service.createSkill(workspaceId, req.params.id, skillInput);
      if (agent_id) {
        const agentsService = new AgentsService(app.container);
        const links = await agentsService.linkSkill(workspaceId, agent_id, skill.id);
        if (!links) throw new NotFoundError('Agent not found');
      }
      return skill;
    },
  );

  app.patch(
    '/repos/:id/conventions/:conventionId',
    { schema: { params: ConventionParams, body: PatchBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const convention = await service.update(workspaceId, req.params.conventionId, req.body);
      if (!convention) throw new NotFoundError('Convention not found');
      return convention;
    },
  );
}
