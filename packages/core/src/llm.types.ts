import { compactBlockSchema, topicSchema } from '@techtok/shared';
import { z } from 'zod';

export const llmCardOutputSchema = z.object({
  cardTitle: z.string().min(1).max(80),
  summary: z.string().min(1).max(320),
  whyItMatters: z.string().min(1).max(160),
  primaryTopic: topicSchema,
  topics: z.array(topicSchema).min(1),
  lang: z.string().min(2).max(8),
});
export type LlmCardOutput = z.infer<typeof llmCardOutputSchema>;

export const llmTranslationOutputSchema = z.object({
  cardTitle: z.string().min(1).max(80),
  summary: z.string().min(1).max(320),
  whyItMatters: z.string().min(1).max(160).optional(),
});
export type LlmTranslationOutput = z.infer<typeof llmTranslationOutputSchema>;

export const llmCompactOutputSchema = z.object({
  blocks: z.array(compactBlockSchema).min(1),
});
export type LlmCompactOutput = z.infer<typeof llmCompactOutputSchema>;

export interface LlmProvider {
  complete(prompt: string): Promise<string>;
}
