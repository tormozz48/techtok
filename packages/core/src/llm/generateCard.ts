import { type LlmCardOutput, type LlmProvider, llmCardOutputSchema } from '../llm.types';
import { callLlmWithRepair } from './callWithRepair';
import { buildCardPrompt, buildRepairPrompt, type CardPromptInput } from './prompts/cardPrompt';

const MAX_INPUT_CHARS = 4000;

/** Same shape the prompt builder consumes — one definition, re-exported under
 * the domain-level name the rest of the codebase uses. */
export type GenerateCardInput = CardPromptInput;

export type GenerateCardResult = { ok: true; card: LlmCardOutput } | { ok: false; reason: string };

/**
 * Derives card copy + topic classification from article text via the LLM
 * (DESIGN §7.4). One repair-retry on invalid output, then reports failure —
 * never throws, since an LLM refusal or a Bedrock hiccup is a content-level
 * failure the caller degrades to an excerpt card, per §7.2.
 */
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
