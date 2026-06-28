import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { ConventionCandidate, Skill, SkillType } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import { SkillsRepository } from '../skills/repository.js';
import { toSkillDto } from '../skills/helpers.js';
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

EVIDENCE LINE REQUIREMENTS — the line you cite must directly demonstrate the rule:
- naming rules: cite the line that declares or defines the symbol (const, let, var, function, class, interface, type, enum). Do NOT cite a nearby comment, a brace, or an object field that doesn't name the symbol.
- typing rules: cite the line that contains the type annotation (": SomeType"), generic ("<T>"), or typed signature. Do NOT cite "try {", a comment, or a plain assignment.
- imports rules: cite the line that contains the import or export statement itself.
- error-handling rules: cite the line with "throw", "catch", or "new Error()" — not just "try {" alone.
- documentation rules: you MAY cite a comment line (// or /* ...) as evidence.
- formatting rules: cite the line that exhibits the formatting pattern.
BAD evidence (never cite these for non-documentation rules): comment lines (// ..., /* ..., * ...), bare braces ({ or }), closing punctuation (});  }), control-flow openers without a body (try {, catch {, else {).

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

// Matches control-flow openers and bare structural punctuation that carry no
// semantic information about the rule being cited.
const STRUCTURAL_ONLY_RE =
  /^(?:try\s*\{|catch\s*(?:\([^)]*\))?\s*\{|finally\s*\{|else(?:\s+if\s*\([^)]*\))?\s*\{|\{|\}[;,)]*|\][;,]*|[;,])$/;

// Matches a bare object-property key line (e.g. `  stale: { ... },`) that has
// no declaration keyword — these are never valid evidence for naming/typing/imports.
const OBJECT_FIELD_RE = /^\s*\w[\w.]*\s*:/;
const DECLARATION_KEYWORD_RE = /\b(?:const|let|var|function|class|interface|type|enum|return|throw|import|export)\b/;

/**
 * Returns true when the trimmed snippet is semantically weak evidence for the
 * given category and should be rejected regardless of the LLM's claim.
 *
 * Rejected universally (all categories):
 *   - Structural-only lines: bare braces, "try {", "catch {", "});", "];", etc.
 *   - Comment lines ("//", "/*", leading "*") — EXCEPT for documentation rules.
 *
 * Category-specific:
 *   - naming/typing/imports → generic object-field lines (no declaration keyword)
 *   - naming/typing         → import/export lines (cite the symbol declaration instead)
 *   - imports               → line must contain the word "import" or "export"
 *   - typing                → line must contain a type annotation (": Word") or generic ("<Word")
 */
function isWeakEvidence(category: string, snippet: string): boolean {
  const s = snippet.trim();

  if (STRUCTURAL_ONLY_RE.test(s)) return true;

  // Comment lines are valid evidence only for documentation rules.
  if (/^(?:\/\/|\/\*|\*(?!\s*\/))/.test(s) && category !== 'documentation') return true;

  // Generic object-field lines (no declaration keyword) are weak for naming/typing/imports.
  if (
    (category === 'naming' || category === 'typing' || category === 'imports') &&
    OBJECT_FIELD_RE.test(s) &&
    !DECLARATION_KEYWORD_RE.test(s)
  )
    return true;

  // Naming and typing rules must cite a declaration, not an import/export line.
  if (
    (category === 'naming' || category === 'typing') &&
    /^\s*(?:import|export)\b/.test(s)
  )
    return true;

  if (category === 'imports' && !/\b(?:import|export)\b/.test(s)) return true;

  if (category === 'typing' && !(/:\s*\w/.test(s) || /<\w/.test(s))) return true;

  return false;
}

/**
 * Deterministic evidence validation — every candidate emitted by the LLM must
 * survive all checks before being persisted:
 *  1. The file exists in the local clone.
 *  2. The line number is within the actual file.
 *  3. The evidence_snippet is taken verbatim from that line (not from the LLM).
 *  4. The snippet is non-empty after trimming (blank/whitespace-only lines are
 *     not useful evidence and indicate the LLM cited the wrong line).
 *  5. The snippet is not semantically weak evidence for the rule category.
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
    if (isWeakEvidence(c.category, snippet)) continue; // semantically weak → reject
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
// Directory-stratified sample selection helpers.
// ---------------------------------------------------------------------------

/**
 * Returns the directory group key for a file path — at most the first 3
 * directory segments, excluding the filename itself. Root-level files get
 * the sentinel key 'root'. Capping at 3 segments prevents over-splitting
 * deep trees while still separating e.g. src/modules/reviews from
 * src/platform and src/adapters/llm.
 */
function dirGroup(filePath: string): string {
  const parts = filePath.split('/');
  const dirParts = parts.slice(0, -1);
  if (dirParts.length === 0) return 'root';
  return dirParts.slice(0, 3).join('/');
}

/**
 * Selects `n` paths from `paths` using a round-robin across directory groups
 * so that no single directory dominates the sample. Within each group the
 * input order (PageRank DESC) is preserved, so the highest-ranked file from
 * each directory is always chosen first.
 *
 * Falls back to straight rank order when all paths share one group (flat
 * repos or when the pool is small enough that no diversification is needed).
 */
export function diversifyPaths(paths: string[], n: number): string[] {
  if (paths.length <= n) return paths;

  const groups = new Map<string, string[]>();
  for (const p of paths) {
    const g = dirGroup(p);
    const arr = groups.get(g);
    if (arr) arr.push(p);
    else groups.set(g, [p]);
  }

  if (groups.size <= 1) return paths.slice(0, n);

  const queues = [...groups.values()];
  const result: string[] = [];
  let anyProgress = true;
  while (result.length < n && anyProgress) {
    anyProgress = false;
    for (const queue of queues) {
      if (result.length >= n) break;
      if (queue.length > 0) {
        result.push(queue.shift()!);
        anyProgress = true;
      }
    }
  }
  return result;
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

// ---------------------------------------------------------------------------
// Markdown builder for convention skills.
// Groups accepted candidates by category and emits evidence-cited sections.
// ---------------------------------------------------------------------------

export function buildConventionMarkdown(fullName: string, candidates: ConventionRow[]): string {
  const accepted = candidates.filter((c) => c.accepted);

  const byCategory = new Map<string, ConventionRow[]>();
  for (const c of accepted) {
    const cat = c.category ?? 'General';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(c);
  }

  const lines: string[] = [
    `# ${fullName} Conventions`,
    '',
    'Flag changes that violate these rules and cite file:line when raising an issue.',
    '',
  ];

  for (const [cat, rules] of byCategory) {
    lines.push(`## ${cat}`, '');
    for (const r of rules) {
      lines.push(`- ${r.rule}`);
      if (r.evidencePath && r.evidenceLine != null) {
        lines.push('', `  Evidence: \`${r.evidencePath}:${r.evidenceLine}\``);
        if (r.evidenceSnippet) {
          lines.push('  ```', `  ${r.evidenceSnippet}`, '  ```');
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export interface SkillPreview {
  name: string;
  description: string;
  type: 'convention';
  enabled: true;
  body: string;
  token_count: number;
}

export interface CreateConventionSkillInput {
  name: string;
  description: string;
  type: SkillType;
  enabled: boolean;
  body: string;
}

// ---------------------------------------------------------------------------

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

    const [configFiles, allSamplePaths] = await Promise.all([
      gatherConfigFiles(clonePath),
      this.container.repoIntel.getConventionSamples(repoId, 60),
    ]);
    const samplePaths = diversifyPaths(allSamplePaths, 12);
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

  async previewSkill(
    workspaceId: string,
    repoId: string,
    candidateIds?: string[],
  ): Promise<SkillPreview> {
    const repoMeta = await this.repo.getRepoMeta(workspaceId, repoId);
    if (!repoMeta) throw new NotFoundError('Repo not found');

    const all = await this.repo.list(workspaceId, repoId);
    let accepted = all.filter((c) => c.accepted);
    if (candidateIds !== undefined) {
      const idSet = new Set(candidateIds);
      accepted = accepted.filter((c) => idSet.has(c.id));
    }
    if (accepted.length === 0) {
      throw new ValidationError('No accepted candidates found for this repo');
    }

    const body = buildConventionMarkdown(repoMeta.fullName, accepted);
    const tokenCount = this.container.tokenizer.count(body);

    return {
      name: `${repoMeta.fullName} Conventions`,
      description: `Convention rules extracted from ${repoMeta.fullName}`,
      type: 'convention',
      enabled: true,
      body,
      token_count: tokenCount,
    };
  }

  async createSkill(
    workspaceId: string,
    repoId: string,
    input: CreateConventionSkillInput,
  ): Promise<Skill> {
    const all = await this.repo.list(workspaceId, repoId);
    const accepted = all.filter((c) => c.accepted);
    const evidenceFiles = [
      ...new Set(accepted.map((c) => c.evidencePath).filter((p): p is string => p != null)),
    ];

    const skillsRepo = new SkillsRepository(this.container.db);
    const row = await skillsRepo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      source: 'extracted',
      body: input.body,
      enabled: input.enabled,
      evidenceFiles: evidenceFiles.length > 0 ? evidenceFiles : undefined,
    });

    const tokenCount = this.container.tokenizer.count(row.body);
    return toSkillDto(row, tokenCount);
  }
}
