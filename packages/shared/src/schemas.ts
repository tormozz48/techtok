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

export const transformKindSchema = z.enum(['llm', 'excerpt']);
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
  sourceCount: z.number().int().min(2).optional(),
});
export type Card = z.infer<typeof cardSchema>;

export const feedResponseSchema = z.object({
  items: z.array(cardSchema),
  nextBefore: z.string().nullable(),
  quotaExhausted: z.literal(true).optional(),
  resetsAt: z.iso.datetime().optional(),
  language: languageSchema.optional(),
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

export const sourcesResponseSchema = z.object({
  sources: z.array(
    z.object({
      sourceId: z.string(),
      name: z.string(),
    }),
  ),
});
export type SourcesResponse = z.infer<typeof sourcesResponseSchema>;

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

export const DEVICE_LANGUAGE_HEADER = 'x-device-language';
export const DEVICE_TIMEZONE_HEADER = 'x-device-timezone';
export const REQUEST_ID_HEADER = 'x-techtok-request-id';

export const meResponseSchema = z.object({
  userId: z.string(),
  topics: z.array(topicSchema),
  createdAt: z.iso.datetime(),
  language: languageSchema,
  mutedSources: z.array(z.string()),
  email: z.string().optional(),
  name: z.string().optional(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const entitlementResponseSchema = z.object({
  plan: z.enum(['free', 'plus']),
  expiresAt: z.iso.datetime().optional(),
  quota: z.object({
    cardReads: z.number().int().min(0),
    cardReadsLimit: z.number().int().min(0),
    readerOpens: z.number().int().min(0),
    readerOpensLimit: z.number().int().min(0),
    resetsAt: z.iso.datetime(),
  }),
});
export type EntitlementResponse = z.infer<typeof entitlementResponseSchema>;

export const topicsPrefsRequestSchema = z.object({
  topics: z.array(topicSchema),
});
export type TopicsPrefsRequest = z.infer<typeof topicsPrefsRequestSchema>;

export const languagePrefsRequestSchema = z.object({
  language: languageSchema,
});
export type LanguagePrefsRequest = z.infer<typeof languagePrefsRequestSchema>;

export const mutedSourcesRequestSchema = z.object({
  sourceIds: z.array(z.string().min(1).max(64)).max(100),
});
export type MutedSourcesRequest = z.infer<typeof mutedSourcesRequestSchema>;

export const readsRequestSchema = z.object({
  postIds: z.array(z.string()).min(1).max(100),
});
export type ReadsRequest = z.infer<typeof readsRequestSchema>;

export const clientLogSchema = z.object({
  kind: z.literal('log'),
  level: z.enum(['error', 'warn', 'info']),
  message: z.string().min(1).max(500),
  context: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.iso.datetime(),
});
export type ClientLog = z.infer<typeof clientLogSchema>;

export const clientAnalyticsEventSchema = z.object({
  kind: z.literal('event'),
  name: z.string().min(1).max(100),
  props: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.iso.datetime(),
});
export type ClientAnalyticsEvent = z.infer<typeof clientAnalyticsEventSchema>;

export const clientRecordSchema = z.discriminatedUnion('kind', [
  clientLogSchema,
  clientAnalyticsEventSchema,
]);
export type ClientRecord = z.infer<typeof clientRecordSchema>;

export const eventsRequestSchema = z.object({
  records: z.array(clientRecordSchema).min(1).max(50),
});
export type EventsRequest = z.infer<typeof eventsRequestSchema>;

export const historyItemSchema = z.object({
  postId: z.string(),
  readAt: z.iso.datetime(),
  cardTitle: z.string(),
  sourceName: z.string(),
  url: z.url(),
  primaryTopic: topicSchema.optional(),
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
  q: z.string().trim().min(1).max(100).optional(),
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
  primaryTopic: topicSchema.optional(),
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
  q: z.string().trim().min(1).max(100).optional(),
});
export type BookmarksQuery = z.infer<typeof bookmarksQuerySchema>;

export const compactBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string().min(1) }),
  z.object({ type: z.literal('heading'), text: z.string().min(1) }),
  z.object({ type: z.literal('list'), items: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('quote'), text: z.string().min(1) }),
  z.object({
    type: z.literal('image'),
    figureIndex: z.number().int().min(0),
    caption: z.string().optional(),
  }),
]);
export type CompactBlock = z.infer<typeof compactBlockSchema>;

export const compactFigureSchema = z.object({
  url: z.url(),
  caption: z.string().optional(),
});
export type CompactFigure = z.infer<typeof compactFigureSchema>;

export const contentQuerySchema = z.object({
  lang: languageSchema.default('en'),
  intent: z.enum(['read', 'prefetch']).default('read'),
});
export type ContentQuery = z.infer<typeof contentQuerySchema>;

export const contentResponseSchema = z.discriminatedUnion('available', [
  z.object({
    available: z.literal(true),
    lang: languageSchema,
    blocks: z.array(compactBlockSchema),
    figures: z.array(compactFigureSchema),
  }),
  z.object({
    available: z.literal(false),
    reason: z.string(),
  }),
]);
export type ContentResponse = z.infer<typeof contentResponseSchema>;
