import { buildCardPrompt, buildRepairPrompt } from './prompts/cardPrompt';
import { type LlmCardOutput, type LlmProvider, llmCardOutputSchema } from './types';

const MAX_INPUT_CHARS = 4000;

export interface GenerateCardInput {
  title: string;
  sourceName: string;
  text: string;
}

export type GenerateCardResult = { ok: true; card: LlmCardOutput } | { ok: false; reason: string };

type AttemptResult =
  | ({ ok: true } & { card: LlmCardOutput })
  | ({ ok: false } & { reason: string; raw?: string });

/**
 * Calls the LLM once, parses and zod-validates its response. Any failure
 * (network error, non-JSON response, schema mismatch) is reported back
 * instead of thrown — the caller decides whether to repair-retry or degrade.
 */
async function attempt(provider: LlmProvider, prompt: string): Promise<AttemptResult> {
  let raw: string;
  try {
    raw = await provider.complete(prompt);
  } catch (err) {
    return { ok: false, reason: `llm call failed: ${toMessage(err)}` };
  }

  let json: unknown;
  try {
    json = JSON.parse(extractJson(raw));
  } catch (err) {
    return { ok: false, reason: `invalid JSON: ${toMessage(err)}`, raw };
  }

  const parsed = llmCardOutputSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: `schema validation failed: ${parsed.error.message}`, raw };
  }
  return { ok: true, card: parsed.data };
}

function extractJson(raw: string): string {
  // Models sometimes wrap JSON in markdown fences despite instructions.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? raw).trim();
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

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

  const first = await attempt(provider, prompt);
  if (first.ok) return first;

  const repairPrompt = buildRepairPrompt(prompt, first.raw ?? '(no response)', first.reason);
  const second = await attempt(provider, repairPrompt);
  if (second.ok) return second;

  return { ok: false, reason: `${first.reason}; repair retry: ${second.reason}` };
}
