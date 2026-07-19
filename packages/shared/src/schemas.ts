import { z } from 'zod';
import { TOPICS } from './topics';

export const topicSchema = z.enum(TOPICS);

export const mediaItemSchema = z.object({
  kind: z.literal('image'),
  url: z.url(),
});
export type MediaItem = z.infer<typeof mediaItemSchema>;

export const transformKindSchema = z.enum(['llm', 'excerpt', 'skipped']);
export type TransformKind = z.infer<typeof transformKindSchema>;

export const cardSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  whyItMatters: z.string().optional(),
  imageUrl: z.url().optional(),
  blurhash: z.string().optional(),
  sourceName: z.string(),
  url: z.url(),
  primaryTopic: topicSchema,
  topics: z.array(topicSchema),
  publishedAt: z.iso.datetime(),
  media: z.array(mediaItemSchema).optional(),
  transform: transformKindSchema.optional(),
});
export type Card = z.infer<typeof cardSchema>;

export const feedResponseSchema = z.object({
  items: z.array(cardSchema),
  nextBefore: z.string().nullable(),
});
export type FeedResponse = z.infer<typeof feedResponseSchema>;

export const topicsResponseSchema = z.object({
  topics: z.array(
    z.object({
      id: topicSchema,
      label: z.string(),
    }),
  ),
});
export type TopicsResponse = z.infer<typeof topicsResponseSchema>;

export const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.iso.datetime().optional(),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const DEVICE_ID_HEADER = 'x-device-id';

export const meResponseSchema = z.object({
  userId: z.string(),
  topics: z.array(topicSchema),
  createdAt: z.iso.datetime(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const topicsPrefsRequestSchema = z.object({
  topics: z.array(topicSchema),
});
export type TopicsPrefsRequest = z.infer<typeof topicsPrefsRequestSchema>;

export const readsRequestSchema = z.object({
  postIds: z.array(z.string()).min(1).max(100),
});
export type ReadsRequest = z.infer<typeof readsRequestSchema>;

export const historyItemSchema = z.object({
  postId: z.string(),
  readAt: z.iso.datetime(),
  cardTitle: z.string(),
  sourceName: z.string(),
  url: z.url(),
});
export type HistoryItem = z.infer<typeof historyItemSchema>;

export const historyResponseSchema = z.object({
  items: z.array(historyItemSchema),
  nextCursor: z.string().nullable(),
});
export type HistoryResponse = z.infer<typeof historyResponseSchema>;

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
