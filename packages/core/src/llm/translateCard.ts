import {
  type LlmProvider,
  type LlmTranslationOutput,
  llmTranslationOutputSchema,
} from '../llm.types';
import { errorMessage } from '../util/errors';
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

type AttemptResult =
  | ({ ok: true } & { translation: LlmTranslationOutput })
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
    return { ok: false, reason: `llm call failed: ${errorMessage(err)}` };
  }

  let json: unknown;
  try {
    json = JSON.parse(extractJson(raw));
  } catch (err) {
    return { ok: false, reason: `invalid JSON: ${errorMessage(err)}`, raw };
  }

  const parsed = llmTranslationOutputSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: `schema validation failed: ${parsed.error.message}`, raw };
  }
  return { ok: true, translation: parsed.data };
}

function extractJson(raw: string): string {
  // Models sometimes wrap JSON in markdown fences despite instructions.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? raw).trim();
}

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

  const first = await attempt(provider, prompt);
  if (first.ok) return first;

  const repairPrompt = buildTranslateRepairPrompt(
    prompt,
    first.raw ?? '(no response)',
    first.reason,
  );
  const second = await attempt(provider, repairPrompt);
  if (second.ok) return second;

  return { ok: false, reason: `${first.reason}; repair retry: ${second.reason}` };
}
