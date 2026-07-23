import { z } from 'zod';
import { LANGUAGES } from './language';
import { TOPICS } from './topics';

export const topicSchema = z.enum(TOPICS);

export const languageSchema = z.enum(LANGUAGES);

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
  isBookmarked: z.boolean().optional(),
  servedLang: languageSchema,
  isTranslated: z.boolean(),
  compactLangs: z.array(languageSchema).default([]),
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

export const topicsQuerySchema = z.object({
  lang: languageSchema.default('en'),
});
export type TopicsQuery = z.infer<typeof topicsQuerySchema>;

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
export const DEVICE_LANGUAGE_HEADER = 'x-device-language';

export const meResponseSchema = z.object({
  userId: z.string(),
  topics: z.array(topicSchema),
  createdAt: z.iso.datetime(),
  language: languageSchema,
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const topicsPrefsRequestSchema = z.object({
  topics: z.array(topicSchema),
});
export type TopicsPrefsRequest = z.infer<typeof topicsPrefsRequestSchema>;

export const languagePrefsRequestSchema = z.object({
  language: languageSchema,
});
export type LanguagePrefsRequest = z.infer<typeof languagePrefsRequestSchema>;

export const pushTokenRequestSchema = z.object({
  pushToken: z.string().min(1),
});
export type PushTokenRequest = z.infer<typeof pushTokenRequestSchema>;

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

export const bookmarkCreateRequestSchema = z.object({
  postId: z.string(),
});
export type BookmarkCreateRequest = z.infer<typeof bookmarkCreateRequestSchema>;

export const bookmarkItemSchema = z.object({
  postId: z.string(),
  bookmarkedAt: z.iso.datetime(),
  cardTitle: z.string(),
  sourceName: z.string(),
  url: z.url(),
});
export type BookmarkItem = z.infer<typeof bookmarkItemSchema>;

export const bookmarksResponseSchema = z.object({
  items: z.array(bookmarkItemSchema),
  nextCursor: z.string().nullable(),
});
export type BookmarksResponse = z.infer<typeof bookmarksResponseSchema>;

export const bookmarksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
export type BookmarksQuery = z.infer<typeof bookmarksQuerySchema>;
