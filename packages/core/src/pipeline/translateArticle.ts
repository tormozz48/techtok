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
  readonly translateCard: (input: {
    lang: Language;
    cardTitle: string;
    summary: string;
    whyItMatters?: string;
  }) => Promise<TranslateCardResult>;
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
