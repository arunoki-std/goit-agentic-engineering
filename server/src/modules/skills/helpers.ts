import type { Skill, SkillSource, SkillType } from '@devdigest/shared';
import type { SkillRow } from './repository.js';

/** Map a persisted skill row to the public `Skill` DTO. */
export function toSkillDto(
  row: SkillRow & { agentCount?: number },
  tokenCount?: number,
): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: (row.evidenceFiles as string[] | null) ?? null,
    ...(row.agentCount !== undefined ? { agent_count: row.agentCount } : {}),
    ...(tokenCount !== undefined ? { token_count: tokenCount } : {}),
  };
}

/**
 * Extract skill name and body from a markdown string.
 * Name = first `# Heading` stripped of `#`; falls back to `nameHint` or "untitled-skill".
 */
export function parseMarkdown(body: string, nameHint?: string): { name: string; body: string } {
  const trimmed = body.trim();
  const headingMatch = trimmed.match(/^#\s+(.+)$/m);
  const name = headingMatch?.[1]
    ? headingMatch[1].trim().toLowerCase().replace(/\s+/g, '-')
    : (nameHint ?? 'untitled-skill');
  return { name, body: trimmed };
}

/** Private IP and loopback ranges blocked for URL import (SSRF prevention). */
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fd[0-9a-f]{2}:/i,
  /^localhost$/i,
];

export function isBlockedHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((p) => p.test(hostname));
}
