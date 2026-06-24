import type { ConventionCandidate } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { ConventionsRepository, type ConventionRow, type UpdateConvention } from './repository.js';

function toDto(row: ConventionRow): ConventionCandidate {
  return {
    id: row.id,
    category: row.category,
    rule: row.rule,
    evidence_path: row.evidencePath,
    evidence_line: row.evidenceLine,
    evidence_snippet: row.evidenceSnippet,
    confidence: row.confidence,
    accepted: row.accepted,
  };
}

export class ConventionsService {
  private repo: ConventionsRepository;

  constructor(container: Container) {
    this.repo = new ConventionsRepository(container.db);
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionCandidate[]> {
    const rows = await this.repo.list(workspaceId, repoId);
    return rows.map(toDto);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateConvention,
  ): Promise<ConventionCandidate | undefined> {
    const row = await this.repo.update(workspaceId, id, patch);
    if (!row) return undefined;
    return toDto(row);
  }
}
