import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export type ConventionRow = typeof t.conventions.$inferSelect;

export interface UpdateConvention {
  accepted?: boolean;
  rule?: string;
}

export interface InsertConvention {
  category?: string;
  rule: string;
  evidencePath?: string;
  evidenceLine?: number;
  evidenceSnippet?: string;
  confidence?: number;
}

export class ConventionsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)))
      .orderBy(desc(t.conventions.createdAt));
  }

  async getById(workspaceId: string, id: string): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)));
    return row;
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateConvention,
  ): Promise<ConventionRow | undefined> {
    if (Object.keys(patch).length === 0) return this.getById(workspaceId, id);
    const [row] = await this.db
      .update(t.conventions)
      .set({
        ...(patch.accepted !== undefined ? { accepted: patch.accepted } : {}),
        ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
      })
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }

  /** Workspace-scoped clone path lookup — extract pipeline entry point. */
  async getRepoClonable(
    workspaceId: string,
    repoId: string,
  ): Promise<{ clonePath: string | null } | undefined> {
    const [row] = await this.db
      .select({ clonePath: t.repos.clonePath })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row;
  }

  async getRepoMeta(
    workspaceId: string,
    repoId: string,
  ): Promise<{ name: string; fullName: string } | undefined> {
    const [row] = await this.db
      .select({ name: t.repos.name, fullName: t.repos.fullName })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row;
  }

  /**
   * Re-scan policy: delete all previous candidates for this repo, then insert
   * the new validated set. Each extraction run is authoritative — stale
   * candidates from a previous scan are replaced, not accumulated. The scan
   * timestamp is visible via conventions.createdAt on the new rows.
   */
  async replaceAll(
    workspaceId: string,
    repoId: string,
    rows: InsertConvention[],
  ): Promise<ConventionRow[]> {
    await this.db
      .delete(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));
    if (rows.length === 0) return [];
    const inserted = await this.db
      .insert(t.conventions)
      .values(
        rows.map((r) => ({
          workspaceId,
          repoId,
          category: r.category,
          rule: r.rule,
          evidencePath: r.evidencePath,
          evidenceLine: r.evidenceLine,
          evidenceSnippet: r.evidenceSnippet,
          confidence: r.confidence,
          accepted: false,
        })),
      )
      .returning();
    return inserted;
  }
}
