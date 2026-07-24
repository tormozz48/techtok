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
  /** Derives the translated card fields via the LLM (D21/D27). Never expected
   * to throw — an LLM refusal, invalid output, or a Bedrock hiccup is a
   * content-level failure reported via `{ ok: false }` so this function can
   * degrade by simply not writing a translation. */
  readonly translateCard: (input: {
    lang: Language;
    cardTitle: string;
    summary: string;
    whyItMatters?: string;
  }) => Promise<TranslateCardResult>;
  /** Persists the translation. An infra call, deliberately unguarded so a
   * failure propagates (SQS retry -> DLQ), not swallowed as a degrade. */
  readonly writeTranslation: (
    postId: string,
    lang: Language,
    fields: TranslatedFields,
  ) => Promise<void>;
}

export interface TranslateOutcome {
  readonly translated: boolean;
  readonly reason?: string;
}

/**
 * Translates a post's card fields into `input.lang` (D21/D27): calls the LLM
 * and writes `i18n[lang]`; on any content-level LLM failure, just reports it
 * without writing anything — English is always the resting state, so there
 * is no separate degrade state to write. Infra failures (`writeTranslation`)
 * are not caught here; they throw so SQS's own retry/DLQ semantics take over.
 */
export async function translateArticle(
  input: TranslateInput,
  deps: TranslateDeps,
): Promise<TranslateOutcome> {
  const result = await deps.translateCard({
    lang: input.lang,
    cardTitle: input.cardTitle,
    summary: input.summary,
    whyItMatters: input.whyItMatters,
  });

  if (!result.ok) {
    return { translated: false, reason: `llm failed: ${result.reason}` };
  }

  await deps.writeTranslation(input.postId, input.lang, {
    ...result.translation,
    translatedAt: new Date().toISOString(),
  });
  return { translated: true };
}
