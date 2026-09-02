import { type LlmCompactOutput, type LlmProvider, llmCompactOutputSchema } from '../llm.types';
import { callLlmWithRepair } from './callWithRepair';
import {
  buildCompactArticlePrompt,
  buildCompactArticleRepairPrompt,
  type CompactArticlePromptInput,
} from './prompts/compactArticlePrompt';

export type CompactArticleInput = CompactArticlePromptInput;

export type CompactArticleResult =
  | { ok: true; compact: LlmCompactOutput }
  | { ok: false; reason: string };

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
