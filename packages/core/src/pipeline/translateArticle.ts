import type { Language } from '@techtok/shared';
import type { TranslateCardResult } from '../llm/translateCard';
import type { TranslatedFields } from '../posts.types';

export interface TranslateInput {
  readonly postId: string;
  readonly lang: Language;
  readonly cardTitle: string;
  readonly summary: string;
  readonly whyItMatters?: string;
}

export interface TranslateDeps {
  /** Atomically increments today's translation counter (DESIGN §6/D22) and
   * reports whether this translation is still under the daily cap. Over cap
   * is not a failure — it's the cost valve doing its job — so the pending
   * marker is just cleared, no translation written (English is the resting
   * state, per D22). */
  readonly checkDailyCap: () => Promise<boolean>;
  /** Derives the translated card fields via the LLM (D21/D22). Never expected
   * to throw — an LLM refusal, invalid output, or a Bedrock hiccup is a
   * content-level failure reported via `{ ok: false }` so this function can
   * degrade by clearing the pending marker. */
  readonly translateCard: (input: {
    lang: Language;
    cardTitle: string;
    summary: string;
    whyItMatters?: string;
  }) => Promise<TranslateCardResult>;
  /** Persists the translation and clears the pending marker in one write.
   * An infra call, deliberately unguarded so a failure propagates (SQS
   * retry -> DLQ), not swallowed as a degrade. */
  readonly writeTranslation: (
    postId: string,
    lang: Language,
    fields: TranslatedFields,
  ) => Promise<void>;
  /** Clears the pending marker without writing a translation — the degrade
   * path for over-cap or content-level failure. Also an infra call, left
   * unguarded for the same reason as `writeTranslation`. */
  readonly clearPending: (postId: string, lang: Language) => Promise<void>;
}

export interface TranslateOutcome {
  readonly translated: boolean;
  readonly reason?: string;
}

/**
 * Translates a post's card fields into `input.lang` (D21/D22): under the
 * daily cap, calls the LLM and writes `i18n[lang]`; over cap or on any
 * content-level LLM failure, just clears the pending marker — English is
 * always the resting state, so there is no separate degrade state to write.
 * Infra failures (the repo writes) are not caught here; they throw so SQS's
 * own retry/DLQ semantics take over.
 */
export async function translateArticle(
  input: TranslateInput,
  deps: TranslateDeps,
): Promise<TranslateOutcome> {
  const underCap = await deps.checkDailyCap();
  if (!underCap) {
    await deps.clearPending(input.postId, input.lang);
    return { translated: false, reason: 'over daily translation cap' };
  }

  const result = await deps.translateCard({
    lang: input.lang,
    cardTitle: input.cardTitle,
    summary: input.summary,
    whyItMatters: input.whyItMatters,
  });

  if (!result.ok) {
    await deps.clearPending(input.postId, input.lang);
    return { translated: false, reason: `llm failed: ${result.reason}` };
  }

  await deps.writeTranslation(input.postId, input.lang, {
    ...result.translation,
    translatedAt: new Date().toISOString(),
  });
  return { translated: true };
}
