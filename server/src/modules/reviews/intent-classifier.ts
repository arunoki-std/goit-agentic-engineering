import type { Container } from '../../platform/container.js';
import { Intent, type Intent as IntentType } from '@devdigest/shared';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { renderPrompt } from '../../platform/prompts.js';
import type { Logger } from './run-executor.js';

/**
 * Intent classification for a PR.
 *
 * Two exports:
 *   extractHunkHeaders — pure helper that strips full patch bodies down to @@ lines.
 *   classifyIntent     — calls the LLM with hunk-header-only input; logs token savings.
 */

/**
 * Return only the hunk-header lines (those starting with @@) from a unified-diff patch.
 *
 * Pure function — no side effects, no async.
 * All other lines (diff --git, ---, +++, index, context, added, removed) are discarded.
 *
 * @example
 *   extractHunkHeaders('@@ -10,6 +10,8 @@ foo\n+added\n-removed')
 *   // => ['@@ -10,6 +10,8 @@ foo']
 */
export function extractHunkHeaders(patch: string | null | undefined): string[] {
  if (!patch) return [];
  return patch.split('\n').filter((line) => line.startsWith('@@'));
}

/**
 * Classify the intent + scope of a PR using the workspace's configured
 * `review_intent` model.  Only hunk headers (not full diff bodies) are sent
 * to the model, saving ~10–50× tokens over raw patch text.
 */
export async function classifyIntent(
  container: Container,
  workspaceId: string,
  pull: { title: string; body: string | null; number: number },
  repo: { owner: string; name: string },
  prFiles: Array<{ path: string; patch: string | null }>,
  logger?: Logger,
): Promise<IntentType> {
  const { provider, model } = await resolveFeatureModel(container, workspaceId, 'review_intent');
  const llm = await container.llm(provider);

  // Best-effort linked issue — parse first "closes/fixes/resolves #N" from body.
  let issueText = '';
  if (pull.body) {
    const m = pull.body.match(/(?:closes|fixes|resolves)\s+#(\d+)/i);
    if (m?.[1]) {
      try {
        const gh = await container.github();
        const issue = await gh.getIssue(repo, Number(m[1]));
        issueText = [issue.title, issue.body].filter(Boolean).join('\n');
      } catch {
        // best-effort — ignore network / auth failures
      }
    }
  }

  // Build hunk-header-only payload (one block per file that has headers).
  const hunkBlocks: string[] = [];
  for (const file of prFiles) {
    const headers = extractHunkHeaders(file.patch);
    if (headers.length > 0) {
      hunkBlocks.push(`${file.path}:\n${headers.join('\n')}`);
    }
  }

  // Log token savings: full patch vs hunk-headers-only.
  const fullPatchText = prFiles.map((f) => f.patch ?? '').join('\n');
  const hunkHeaderText = hunkBlocks.join('\n');
  const fullPatchTokens = container.tokenizer.count(fullPatchText);
  const hunkHeaderTokens = container.tokenizer.count(hunkHeaderText);
  logger?.info(
    {
      feature: 'review_intent',
      model,
      fullPatchTokens,
      hunkHeaderTokens,
      savedTokens: fullPatchTokens - hunkHeaderTokens,
    },
    'intent-classifier: token savings',
  );

  // Assemble user message.  System prompt owns the SECURITY declaration for
  // the <data> block, so we use plain text + delimiters here (no wrapUntrusted).
  const sections: string[] = [
    `PR #${pull.number}: ${pull.title}`,
  ];
  if (pull.body) sections.push(`\nPR body:\n${pull.body}`);
  if (issueText) sections.push(`\nLinked issue:\n${issueText}`);
  sections.push(`\nFiles changed:\n${prFiles.map((f) => f.path).join('\n')}`);
  if (hunkBlocks.length > 0) {
    sections.push(`\nHunk headers:\n${hunkBlocks.join('\n\n')}`);
  }
  const payload = `<data>\n${sections.join('')}\n</data>`;

  const systemPrompt = await renderPrompt('intent.system.md', {});

  const result = await llm.completeStructured({
    model,
    schema: Intent,
    schemaName: 'Intent',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: payload },
    ],
    temperature: 0,
  });

  return result.data;
}
