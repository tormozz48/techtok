import type { Language } from '@techtok/shared';

export interface TranslatePromptInput {
  readonly lang: Language;
  readonly cardTitle: string;
  readonly summary: string;
  readonly whyItMatters?: string;
}

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  ru: 'Russian',
  uk: 'Ukrainian',
  pl: 'Polish',
};

export function buildTranslatePrompt(input: TranslatePromptInput): string {
  const languageName = LANGUAGE_NAMES[input.lang];

  return `You are translating a card for a TikTok-style tech & science news reader app into ${languageName}. The translation must read naturally to a native ${languageName} speaker, not like a literal machine translation, while staying faithful to the original meaning.

Original card title: ${input.cardTitle}
Original summary: ${input.summary}
${input.whyItMatters ? `Original "why it matters": ${input.whyItMatters}` : ''}

First, draft a translation of each field into ${languageName}. Then critique your own draft for naturalness and accuracy, and correct it. Respond with a single JSON object only — no prose, no markdown code fences, no draft or critique text — containing only the corrected final translation, matching exactly this shape:
{
  "cardTitle": string, the translated card title, at most 80 characters,
  "summary": string, the translated summary, at most 320 characters${
    input.whyItMatters
      ? ',\n  "whyItMatters": string, the translated "why it matters" line, at most 160 characters'
      : ' (omit "whyItMatters" — the original card has none)'
  }
}`;
}

export function buildTranslateRepairPrompt(
  originalPrompt: string,
  invalidResponse: string,
  error: string,
): string {
  return `${originalPrompt}

Your previous response was invalid: ${error}
Previous response:
"""
${invalidResponse}
"""

Reply again with ONLY the corrected JSON object — no extra text, no markdown fences.`;
}
