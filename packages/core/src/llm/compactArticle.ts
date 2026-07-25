import { type LlmCompactOutput, type LlmProvider, llmCompactOutputSchema } from '../llm.types';
import { callLlmWithRepair } from './callWithRepair';
import {
  buildCompactArticlePrompt,
  buildCompactArticleRepairPrompt,
  type CompactArticlePromptInput,
} from './prompts/compactArticlePrompt';

/** Same shape the prompt builder consumes — one definition, re-exported under
 * the domain-level name the rest of the codebase uses. */
export type CompactArticleInput = CompactArticlePromptInput;

export type CompactArticleResult =
  | { ok: true; compact: LlmCompactOutput }
  | { ok: false; reason: string };

/**
 * Compresses (and, for non-English targets, translates) an article into a
 * compact block list (D23), self-critiquing in the same call. One
 * repair-retry on invalid output, then reports failure — never throws, since
 * an LLM refusal or a Bedrock hiccup is a content-level failure the caller
 * degrades from (no compact stored; the reader falls back to the direct
 * link-out).
 */
export async function compactArticle(
  input: CompactArticleInput,
  provider: LlmProvider,
): Promise<CompactArticleResult> {
  const prompt = buildCompactArticlePrompt(input);

  const result = await callLlmWithRepair(
    provider,
    prompt,
    llmCompactOutputSchema,
    buildCompactArticleRepairPrompt,
  );
  return result.ok ? { ok: true, compact: result.value } : result;
}
