import type { Language } from '@techtok/shared';

export interface CompactArticleFigureInput {
  readonly index: number;
  readonly caption?: string;
}

export interface CompactArticlePromptInput {
  readonly lang: Language;
  readonly title: string;
  readonly sourceName: string;
  readonly articleText: string;
  readonly figures: CompactArticleFigureInput[];
}

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  ru: 'Russian',
  uk: 'Ukrainian',
  pl: 'Polish',
};

/**
 * Single-pass compress-and-translate (D23): one Bedrock call compresses the
 * article to ~400-600 words of structured blocks, self-critiquing in the same
 * call when the target language isn't English (mirrors the translate-card
 * prompt's self-critique instruction) — no second LLM call.
 */
export function buildCompactArticlePrompt(input: CompactArticlePromptInput): string {
  const languageName = LANGUAGE_NAMES[input.lang];
  const figureList = input.figures.length
    ? input.figures.map((f) => `${f.index}: ${f.caption ?? '(no caption)'}`).join('\n')
    : '(no figures available for this article)';

  return `You are compressing a tech/science article into a compact in-app reader card for a TikTok-style news app${
    input.lang !== 'en' ? `, writing the result in ${languageName}` : ''
  }. Keep the reader's attention while staying faithful to the article.

Article title: ${input.title}
Source: ${input.sourceName}
Article text:
"""
${input.articleText}
"""

Available figures (reference ONLY by index below — never invent a URL or an index that isn't listed):
${figureList}

${
  input.lang !== 'en'
    ? `First draft the compact version in ${languageName}, then critique your own draft for naturalness and accuracy, and correct it. `
    : ''
}Respond with a single JSON object only — no prose, no markdown code fences, no draft or critique text, and no block that comments on the translation or compression process itself — containing only the corrected final content, matching exactly this shape:
{
  "blocks": an array of 400-600 words total across all blocks, each one of:
    { "type": "paragraph", "text": string } |
    { "type": "heading", "text": string } |
    { "type": "list", "items": string[] } |
    { "type": "quote", "text": string } |
    { "type": "image", "figureIndex": number (must be one of the indices listed above), "caption": string (optional) }
}`;
}

export function buildCompactArticleRepairPrompt(
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
