import { topicSchema } from '@techtok/shared';
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

export interface LlmProvider {
  complete(prompt: string): Promise<string>;
}
