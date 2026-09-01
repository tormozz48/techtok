import { LANGUAGES, TOPICS, type TransformKind, transformKindSchema } from '@techtok/shared';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

const READY_NOT_DUPLICATE = sql`status = 'ready' and duplicate_of is null`;

export const topicEnum = pgEnum('topic', TOPICS);
export const languageEnum = pgEnum('language', LANGUAGES);
export const transformKindEnum = pgEnum(
  'transform_kind',
  transformKindSchema.options as [TransformKind, ...TransformKind[]],
);
export const postStatusEnum = pgEnum('post_status', ['discovered', 'ready', 'failed']);
export const fetchStatusEnum = pgEnum('fetch_status', ['ok', 'not-modified', 'error']);
export const entitlementPlanEnum = pgEnum('entitlement_plan', ['free', 'plus']);
export const entitlementSourceEnum = pgEnum('entitlement_source', ['manual', 'play']);

export const sources = pgTable('sources', {
  sourceId: text('source_id').primaryKey(),
  name: text('name').notNull(),
  rssUrl: text('rss_url').notNull(),
  siteUrl: text('site_url'),
  defaultTopic: topicEnum('default_topic').notNull(),
  weight: real('weight').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  compactEnabled: boolean('compact_enabled'),
  etag: text('etag'),
  lastModified: text('last_modified'),
  lastFetchAt: text('last_fetch_at'),
  lastStatus: fetchStatusEnum('last_status'),
  newestSeenPublishedAt: text('newest_seen_published_at'),
  failCount: integer('fail_count').notNull().default(0),
});

export const posts = pgTable(
  'posts',
  {
    postId: text('post_id').primaryKey(),
    url: text('url').notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.sourceId),
    origTitle: text('orig_title').notNull(),
    excerpt: text('excerpt').notNull(),
    imageUrl: text('image_url'),
    mirroredImageUrl: text('mirrored_image_url'),
    primaryTopic: topicEnum('primary_topic').notNull(),
    status: postStatusEnum('status').notNull(),
    transform: transformKindEnum('transform').notNull(),
    lang: text('lang'),
    s3RawKey: text('s3_raw_key'),
    duplicateOf: text('duplicate_of').references((): AnyPgColumn => posts.postId),
    publishedAt: text('published_at').notNull(),
    ingestedAt: text('ingested_at').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => [
    index('posts_feed_idx')
      .on(t.primaryTopic, t.publishedAt.desc(), t.postId.desc())
      .where(READY_NOT_DUPLICATE),
    index('posts_dup_idx').on(t.duplicateOf),
    index('posts_expiry_idx').on(t.expiresAt),
    index('posts_time_idx').on(t.publishedAt.desc(), t.postId.desc()),
  ],
);

export const postTranslations = pgTable(
  'post_translations',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.postId, { onDelete: 'cascade' }),
    lang: languageEnum('lang').notNull(),
    cardTitle: text('card_title').notNull(),
    summary: text('summary').notNull(),
    whyItMatters: text('why_it_matters'),
    translatedAt: text('translated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.lang] })],
);

export const postTopics = pgTable(
  'post_topics',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.postId, { onDelete: 'cascade' }),
    topic: topicEnum('topic').notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.topic] })],
);

export const postCompacts = pgTable(
  'post_compacts',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.postId, { onDelete: 'cascade' }),
    lang: languageEnum('lang').notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.lang] })],
);

export const postFigures = pgTable(
  'post_figures',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.postId, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    url: text('url').notNull(),
    caption: text('caption'),
  },
  (t) => [primaryKey({ columns: [t.postId, t.position] })],
);

export const users = pgTable('users', {
  userId: text('user_id').primaryKey(),
  createdAt: text('created_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  language: languageEnum('language'),
  timezone: text('timezone'),
  email: text('email'),
  name: text('name'),
});

export const userTopics = pgTable(
  'user_topics',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    topic: topicEnum('topic').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topic] })],
);

export const userMutedSources = pgTable(
  'user_muted_sources',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.sourceId),
  },
  (t) => [primaryKey({ columns: [t.userId, t.sourceId] })],
);

export const userTopicReads = pgTable(
  'user_topic_reads',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    topic: topicEnum('topic').notNull(),
    readCount: integer('read_count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topic] })],
);

export const userQuotas = pgTable(
  'user_quotas',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    cardReads: integer('card_reads').notNull().default(0),
    readerOpens: integer('reader_opens').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

export const userEntitlements = pgTable('user_entitlements', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.userId, { onDelete: 'cascade' }),
  plan: entitlementPlanEnum('plan').notNull(),
  source: entitlementSourceEnum('source').notNull(),
  expiresAt: text('expires_at'),
  productId: text('product_id'),
  purchaseToken: text('purchase_token'),
  verifiedAt: text('verified_at').notNull(),
});

export const userReads = pgTable(
  'user_reads',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    postId: text('post_id').notNull(),
    readAt: text('read_at').notNull(),
    cardTitle: text('card_title').notNull(),
    sourceName: text('source_name').notNull(),
    url: text('url').notNull(),
    primaryTopic: topicEnum('primary_topic'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.postId] }),
    index('user_reads_recent_idx').on(t.userId, t.readAt.desc(), t.postId.desc()),
  ],
);

export const userBookmarks = pgTable(
  'user_bookmarks',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    postId: text('post_id').notNull(),
    bookmarkedAt: text('bookmarked_at').notNull(),
    cardTitle: text('card_title').notNull(),
    sourceName: text('source_name').notNull(),
    url: text('url').notNull(),
    primaryTopic: topicEnum('primary_topic'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.postId] }),
    index('user_bookmarks_recent_idx').on(t.userId, t.bookmarkedAt.desc(), t.postId.desc()),
  ],
);
