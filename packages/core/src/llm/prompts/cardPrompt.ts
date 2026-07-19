import { TOPICS } from '@techtok/shared';

export interface CardPromptInput {
  title: string;
  sourceName: string;
  text: string;
}

const TOPIC_LIST = TOPICS.join(', ');

export function buildCardPrompt(input: CardPromptInput): string {
  return `You are writing a card for a TikTok-style tech & science news reader app. Given an article, produce a punchy card that makes someone want to read more.

Article title: ${input.title}
Source: ${input.sourceName}
Article text:
"""
${input.text}
"""

Respond with a single JSON object only — no prose, no markdown code fences — matching exactly this shape:
{
  "cardTitle": string, a punchy hook title, at most 80 characters,
  "summary": string, 2-3 sentences, at most 320 characters, capturing the core of the article,
  "whyItMatters": string, one sentence, at most 160 characters, on why this matters to the reader,
  "primaryTopic": one of [${TOPIC_LIST}], the single best-fitting topic,
  "topics": an array of 1-3 values from [${TOPIC_LIST}], the primaryTopic included,
  "lang": the ISO 639-1 language code of the article text
}`;
}

export function buildRepairPrompt(
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
