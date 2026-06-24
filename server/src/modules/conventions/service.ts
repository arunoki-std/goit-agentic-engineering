import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { ConventionCandidate } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import {
  ConventionsRepository,
  type ConventionRow,
  type UpdateConvention,
  type InsertConvention,
} from './repository.js';

// ---------------------------------------------------------------------------
// LLM output schema for convention extraction.
// confidence uses .transform() to normalise values into [0,1] without
// rejecting the response — LLMs occasionally emit 1.05 or similar.
// ---------------------------------------------------------------------------

const LLMExtractionSchema = z.object({
  candidates: z.array(
    z.object({
      category: z.string(),
      rule: z.string(),
      evidence: z.object({
        path: z.string(),
        line: z.number().int().min(1),
      }),
      // Optional: when the LLM omits confidence the field is undefined here;
      // validateEvidence normalises it to 0.6 (neutral) rather than 1.0.
      confidence: z.number().optional(),
    }),
  ),
});
type LLMExtraction = z.infer<typeof LLMExtractionSchema>;

const EXTRACTION_SYSTEM_PROMPT = `You are a code-convention analyzer.
Given configuration and source files from a repository, extract ONLY conventions you can directly observe in the provided text.
For every rule you emit, cite the EXACT file path and 1-based line number from the files below that demonstrates it.
Do NOT invent rules without a concrete file and line. Categories: naming, formatting, imports, error-handling, testing, typing, documentation.

CONFIDENCE SCALE — assign carefully, do NOT default to 1.0:
- 0.9–1.0: rule is directly confirmed by a config file value (e.g. "semi": true in eslint config) OR the exact same pattern appears in 3 or more of the provided files
- 0.7–0.89: pattern clearly and unambiguously visible in 1–2 files with a strong, specific evidence line
- 0.5–0.69: pattern observed once and may be file-specific or coincidental
- below 0.5: weak signal — only include if still worth surfacing as a candidate`;

// Max chars per config file / per sample file / total context budget.
const CONFIG_FILE_MAX = 4_000;
const SAMPLE_FILE_MAX = 3_000;
const TOTAL_CONTEXT_MAX = 40_000;

// ---------------------------------------------------------------------------
// Helpers — module-scoped so they can be tested independently.
// ---------------------------------------------------------------------------

async function gatherConfigFiles(
  clonePath: string,
): Promise<{ path: string; content: string }[]> {
  const entries = await readdir(clonePath).catch(() => [] as string[]);
  const matched = entries.filter(
    (name) =>
      name === 'package.json' ||
      /^tsconfig.*\.json$/.test(name) ||
      /^eslint\.config\./.test(name) ||
      /^\.eslintrc/.test(name) ||
      /^prettier\.config\./.test(name) ||
      /^\.prettierrc/.test(name),
  );
  const files: { path: string; content: string }[] = [];
  for (const name of matched) {
    const content = await readFile(join(clonePath, name), 'utf8').catch(() => null);
    if (!content) continue;
    files.push({ path: name, content: content.slice(0, CONFIG_FILE_MAX) });
  }
  return files;
}

async function gatherSampleFiles(
  clonePath: string,
  paths: string[],
): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  let total = 0;
  for (const relPath of paths) {
    if (total >= TOTAL_CONTEXT_MAX) break;
    const content = await readFile(join(clonePath, relPath), 'utf8').catch(() => null);
    if (!content) continue;
    const budget = Math.min(SAMPLE_FILE_MAX, TOTAL_CONTEXT_MAX - total);
    const trimmed = content.slice(0, budget);
    files.push({ path: relPath, content: trimmed });
    total += trimmed.length;
  }
  return files;
}

/**
 * Deterministic evidence validation — every candidate emitted by the LLM must
 * survive all four checks before being persisted:
 *  1. The file exists in the local clone.
 *  2. The line number is within the actual file.
 *  3. The evidence_snippet is taken verbatim from that line (not from the LLM).
 *  4. The snippet is non-empty after trimming (blank/whitespace-only lines are
 *     not useful evidence and indicate the LLM cited the wrong line).
 */
async function validateEvidence(
  clonePath: string,
  candidates: LLMExtraction['candidates'],
): Promise<InsertConvention[]> {
  const valid: InsertConvention[] = [];
  for (const c of candidates) {
    const content = await readFile(join(clonePath, c.evidence.path), 'utf8').catch(() => null);
    if (content === null) continue;
    const lines = content.split('\n');
    const lineIdx = c.evidence.line - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) continue;
    const rawLine = lines[lineIdx] ?? '';
    if (rawLine.trim() === '') continue; // blank / whitespace-only line → reject
    const snippet = rawLine.trimEnd().slice(0, 200);
    // Default to 0.6 (neutral) when LLM omits confidence — never silently use 1.0.
    const confidence = Math.min(1, Math.max(0, c.confidence ?? 0.6));
    valid.push({
      category: c.category,
      rule: c.rule,
      evidencePath: c.evidence.path,
      evidenceLine: c.evidence.line,
      evidenceSnippet: snippet,
      confidence,
    });
  }
  return valid;
}

// ---------------------------------------------------------------------------

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

  constructor(private container: Container) {
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

  /**
   * Run a convention extraction scan for the repo.
   *
   * Context gathering:
   *   - Root config files (package.json, tsconfig*.json, eslint/prettier configs).
   *   - Top-12 source files ranked by repo-intel (skips tests/configs/migrations).
   *   - Per-file and total char budgets prevent sending the whole repo to the LLM.
   *
   * After the LLM call, every candidate goes through deterministic evidence
   * validation: the cited file must exist in the clone and the line number must
   * be within the file. Only validated candidates are persisted.
   *
   * Re-scan replaces all previous candidates for this repo (see replaceAll).
   */
  async extract(workspaceId: string, repoId: string): Promise<ConventionCandidate[]> {
    const repoRow = await this.repo.getRepoClonable(workspaceId, repoId);
    if (!repoRow || !repoRow.clonePath) {
      throw new NotFoundError('Repo not found or not yet cloned');
    }
    const clonePath = repoRow.clonePath;

    const [configFiles, samplePaths] = await Promise.all([
      gatherConfigFiles(clonePath),
      this.container.repoIntel.getConventionSamples(repoId, 12),
    ]);
    const sampleFiles = await gatherSampleFiles(clonePath, samplePaths);

    const contextParts: string[] = [];
    for (const { path, content } of [...configFiles, ...sampleFiles]) {
      contextParts.push(`## ${path}\n\`\`\`\n${content}\n\`\`\``);
    }

    const llm = await this.container.llm('openrouter');
    const result = await llm.completeStructured({
      model: 'openai/gpt-4.1',
      schema: LLMExtractionSchema,
      schemaName: 'ConventionExtraction',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Repository files:\n\n${contextParts.join('\n\n')}\n\nExtract conventions. Each must cite the exact file and line number from the files above.`,
        },
      ],
      temperature: 0,
      maxTokens: 4096,
    });

    const validated = await validateEvidence(clonePath, result.data.candidates);
    const saved = await this.repo.replaceAll(workspaceId, repoId, validated);
    return saved.map(toDto);
  }
}
