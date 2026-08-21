import type { z } from 'zod';
import type { LlmProvider } from '../llm.types';
import { errorMessage } from '../util/errors';

export type CallWithRepairResult<T> = { ok: true; value: T } | { ok: false; reason: string };

type AttemptResult<T> = { ok: true; value: T } | { ok: false; reason: string; raw?: string };

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? raw).trim();
}

async function attempt<T>(
  provider: LlmProvider,
  prompt: string,
  schema: z.ZodType<T>,
): Promise<AttemptResult<T>> {
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

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: `schema validation failed: ${parsed.error.message}`, raw };
  }
  return { ok: true, value: parsed.data };
}

export async function callLlmWithRepair<T>(
  provider: LlmProvider,
  prompt: string,
  schema: z.ZodType<T>,
  buildRepairPrompt: (prompt: string, raw: string, reason: string) => string,
): Promise<CallWithRepairResult<T>> {
  const first = await attempt(provider, prompt, schema);
  if (first.ok) return first;

  const repairPrompt = buildRepairPrompt(prompt, first.raw ?? '(no response)', first.reason);
  const second = await attempt(provider, repairPrompt, schema);
  if (second.ok) return second;

  return { ok: false, reason: `${first.reason}; repair retry: ${second.reason}` };
}
