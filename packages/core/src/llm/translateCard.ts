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

export type TranslateCardInput = TranslatePromptInput;

export type TranslateCardResult =
  | { ok: true; translation: LlmTranslationOutput }
  | { ok: false; reason: string };

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
