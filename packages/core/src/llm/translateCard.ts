import {
  type LlmProvider,
  type LlmTranslationOutput,
  llmTranslationOutputSchema,
} from '../llm.types';
import { callLlmWithRepair } from './callWithRepair';
import {
  buildTranslatePrompt,
  buildTranslateRepairPrompt,
  type TranslatePromptInput,
} from './prompts/translatePrompt';

/** Same shape the prompt builder consumes — one definition, re-exported under
 * the domain-level name the rest of the codebase uses. */
export type TranslateCardInput = TranslatePromptInput;

export type TranslateCardResult =
  | { ok: true; translation: LlmTranslationOutput }
  | { ok: false; reason: string };

/**
 * Translates a card's English fields into the requested language via the
 * LLM (D21/D22), self-critiquing in the same call. One repair-retry on
 * invalid output, then reports failure — never throws, since an LLM refusal
 * or a Bedrock hiccup is a content-level failure the caller degrades from
 * (clear the pending marker, stay English — no separate excerpt-style
 * degrade needed here, per D22).
 */
export async function translateCard(
  input: TranslateCardInput,
  provider: LlmProvider,
): Promise<TranslateCardResult> {
  const prompt = buildTranslatePrompt(input);

  const result = await callLlmWithRepair(
    provider,
    prompt,
    llmTranslationOutputSchema,
    buildTranslateRepairPrompt,
  );
  return result.ok ? { ok: true, translation: result.value } : result;
}
