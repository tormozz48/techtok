import { type LlmCardOutput, type LlmProvider, llmCardOutputSchema } from '../llm.types';
import { callLlmWithRepair } from './callWithRepair';
import { buildCardPrompt, buildRepairPrompt, type CardPromptInput } from './prompts/cardPrompt';

const MAX_INPUT_CHARS = 4000;

export type GenerateCardInput = CardPromptInput;

export type GenerateCardResult = { ok: true; card: LlmCardOutput } | { ok: false; reason: string };

export async function generateCard(
  input: GenerateCardInput,
  provider: LlmProvider,
): Promise<GenerateCardResult> {
  const truncated = input.text.slice(0, MAX_INPUT_CHARS);
  const prompt = buildCardPrompt({
    title: input.title,
    sourceName: input.sourceName,
    text: truncated,
  });

  const result = await callLlmWithRepair(provider, prompt, llmCardOutputSchema, buildRepairPrompt);
  return result.ok ? { ok: true, card: result.value } : result;
}
