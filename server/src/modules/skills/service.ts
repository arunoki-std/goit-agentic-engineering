import type { Container } from '../../platform/container.js';
import type { Skill, SkillSource, SkillType } from '@devdigest/shared';
import { SkillsRepository } from './repository.js';
import { toSkillDto, parseMarkdown, isBlockedHost } from './helpers.js';

export interface CreateSkillInput {
  name: string;
  description?: string;
  type: SkillType;
  body: string;
  enabled?: boolean;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

export interface ImportSkillInput {
  body: string;
  name?: string;
  source: SkillSource;
  description?: string;
  type?: SkillType;
}

export class SkillsService {
  private repo: SkillsRepository;

  constructor(private container: Container) {
    this.repo = new SkillsRepository(container.db);
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map((r) => toSkillDto(r));
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) return undefined;
    const tokenCount = this.container.tokenizer.count(row.body);
    return toSkillDto(row, tokenCount);
  }

  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description ?? '',
      type: input.type,
      source: 'manual',
      body: input.body,
      enabled: input.enabled ?? true,
    });
    const tokenCount = this.container.tokenizer.count(row.body);
    return toSkillDto(row, tokenCount);
  }

  async update(workspaceId: string, id: string, patch: UpdateSkillInput): Promise<Skill | undefined> {
    const row = await this.repo.update(workspaceId, id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    });
    if (!row) return undefined;
    const tokenCount = this.container.tokenizer.count(row.body);
    return toSkillDto(row, tokenCount);
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  async listVersions(workspaceId: string, id: string) {
    const skill = await this.repo.getById(workspaceId, id);
    if (!skill) return undefined;
    const rows = await this.repo.listVersions(id);
    return rows.map((r) => ({
      skill_id: r.skillId,
      version: r.version,
      body: r.body,
      created_at: r.createdAt.toISOString(),
      token_count: this.container.tokenizer.count(r.body),
    }));
  }

  /** Parse markdown text → { name, body }. Pure, no DB access. */
  parseImport(body: string, nameHint?: string) {
    return parseMarkdown(body, nameHint);
  }

  /** Fetch a URL server-side and parse its body. Throws on validation failure. */
  async fetchAndParseUrl(url: string): Promise<{ name: string; body: string }> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Invalid URL');
    }
    if (parsed.protocol !== 'https:') throw new Error('Only https:// URLs are allowed');
    if (isBlockedHost(parsed.hostname)) throw new Error('URL resolves to a blocked/private address');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    let text: string;
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 100_000) throw new Error('Response too large (>100KB)');
      text = new TextDecoder().decode(buf);
    } finally {
      clearTimeout(timer);
    }
    return parseMarkdown(text);
  }

  async importSkill(workspaceId: string, input: ImportSkillInput): Promise<Skill> {
    const { name: parsedName, body } = parseMarkdown(input.body, input.name);
    const row = await this.repo.insert({
      workspaceId,
      name: parsedName,
      description: input.description ?? '',
      type: input.type ?? 'custom',
      source: input.source,
      body,
      enabled: input.source === 'manual',
    });
    const tokenCount = this.container.tokenizer.count(row.body);
    return toSkillDto(row, tokenCount);
  }
}
