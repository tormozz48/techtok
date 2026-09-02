import { LANGUAGES, type Topic, type TransformKind, transformKindSchema } from '@techtok/shared';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

const READY_NOT_DUPLICATE = sql`status = 'ready' and duplicate_of_post_id is null`;

const REFERENCE_DATA = { onDelete: 'restrict', onUpdate: 'cascade' } as const;

const DETACH_ON_DELETE = { onDelete: 'set null', onUpdate: 'cascade' } as const;

const OWNED = { onDelete: 'cascade', onUpdate: 'cascade' } as const;

export const languageEnum = pgEnum('language', LANGUAGES);
export const transformKindEnum = pgEnum(
  'transform_kind',
  transformKindSchema.options as [TransformKind, ...TransformKind[]],
);
export const postStatusEnum = pgEnum('post_status', ['discovered', 'ready', 'failed']);
export const fetchStatusEnum = pgEnum('fetch_status', ['ok', 'not-modified', 'error']);
export const entitlementPlanEnum = pgEnum('entitlement_plan', ['free', 'plus']);
export const entitlementSourceEnum = pgEnum('entitlement_source', ['manual', 'play']);

export const topics = pgTable('topics', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  slug: text('slug').$type<Topic>().notNull().unique(),
});

export const sources = pgTable(
  'sources',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    rssUrl: text('rss_url').notNull(),
    siteUrl: text('site_url'),
    defaultTopicId: integer('default_topic_id')
      .notNull()
      .references(() => topics.id, REFERENCE_DATA),
    weight: real('weight').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    compactEnabled: boolean('compact_enabled'),
  },
  (t) => [index('sources_default_topic_idx').on(t.defaultTopicId)],
);

export const sourceStates = pgTable('source_states', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sourceId: integer('source_id')
    .notNull()
    .unique()
    .references(() => sources.id, OWNED),
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
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    url: text('url').notNull(),
    canonicalUrl: text('canonical_url').notNull().unique(),
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id, OWNED),
    origTitle: text('orig_title').notNull(),
    excerpt: text('excerpt').notNull(),
    imageUrl: text('image_url'),
    mirroredImageUrl: text('mirrored_image_url'),
    primaryTopicId: integer('primary_topic_id')
      .notNull()
      .references(() => topics.id, REFERENCE_DATA),
    status: postStatusEnum('status').notNull(),
    transform: transformKindEnum('transform').notNull(),
    lang: text('lang'),
    s3RawKey: text('s3_raw_key'),
    duplicateOfPostId: integer('duplicate_of_post_id').references(
      (): AnyPgColumn => posts.id,
      DETACH_ON_DELETE,
    ),
    publishedAt: text('published_at').notNull(),
    ingestedAt: text('ingested_at').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => [
    index('posts_source_idx').on(t.sourceId),
    index('posts_primary_topic_idx').on(t.primaryTopicId),
    index('posts_feed_idx')
      .on(t.primaryTopicId, t.publishedAt.desc(), t.id.desc())
      .where(READY_NOT_DUPLICATE),
    index('posts_dup_idx').on(t.duplicateOfPostId),
    index('posts_expiry_idx').on(t.expiresAt),
    index('posts_time_idx').on(t.publishedAt.desc(), t.id.desc()),
  ],
);

export const postTranslations = pgTable(
  'post_translations',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, OWNED),
    lang: languageEnum('lang').notNull(),
    cardTitle: text('card_title').notNull(),
    summary: text('summary').notNull(),
    whyItMatters: text('why_it_matters'),
    translatedAt: text('translated_at').notNull(),
  },
  (t) => [unique('post_translations_post_lang_key').on(t.postId, t.lang)],
);

export const postTopics = pgTable(
  'post_topics',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, OWNED),
    topicId: integer('topic_id')
      .notNull()
      .references(() => topics.id, OWNED),
  },
  (t) => [
    unique('post_topics_post_topic_key').on(t.postId, t.topicId),
    index('post_topics_topic_idx').on(t.topicId),
  ],
);

export const postCompacts = pgTable(
  'post_compacts',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, OWNED),
    lang: languageEnum('lang').notNull(),
  },
  (t) => [unique('post_compacts_post_lang_key').on(t.postId, t.lang)],
);

export const postFigures = pgTable(
  'post_figures',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, OWNED),
    position: integer('position').notNull(),
    url: text('url').notNull(),
    caption: text('caption'),
  },
  (t) => [unique('post_figures_post_position_key').on(t.postId, t.position)],
);

export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  externalId: text('external_id').notNull().unique(),
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
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, OWNED),
    topicId: integer('topic_id')
      .notNull()
      .references(() => topics.id, OWNED),
  },
  (t) => [
    unique('user_topics_user_topic_key').on(t.userId, t.topicId),
    index('user_topics_topic_idx').on(t.topicId),
  ],
);

export const userMutedSources = pgTable(
  'user_muted_sources',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, OWNED),
    sourceSlug: text('source_slug').notNull(),
  },
  (t) => [unique('user_muted_sources_user_slug_key').on(t.userId, t.sourceSlug)],
);

export const userTopicReads = pgTable(
  'user_topic_reads',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, OWNED),
    topicId: integer('topic_id')
      .notNull()
      .references(() => topics.id, OWNED),
    readCount: integer('read_count').notNull().default(0),
  },
  (t) => [
    unique('user_topic_reads_user_topic_key').on(t.userId, t.topicId),
    index('user_topic_reads_topic_idx').on(t.topicId),
  ],
);

export const userQuotas = pgTable(
  'user_quotas',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, OWNED),
    day: text('day').notNull(),
    cardReads: integer('card_reads').notNull().default(0),
    readerOpens: integer('reader_opens').notNull().default(0),
  },
  (t) => [unique('user_quotas_user_day_key').on(t.userId, t.day)],
);

export const userEntitlements = pgTable('user_entitlements', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, OWNED),
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
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, OWNED),
    postId: integer('post_id').notNull(),
    readAt: text('read_at').notNull(),
    cardTitle: text('card_title').notNull(),
    sourceName: text('source_name').notNull(),
    url: text('url').notNull(),
    primaryTopicId: integer('primary_topic_id').references(() => topics.id, DETACH_ON_DELETE),
  },
  (t) => [
    unique('user_reads_user_post_key').on(t.userId, t.postId),
    index('user_reads_recent_idx').on(t.userId, t.readAt.desc(), t.postId.desc()),
    index('user_reads_primary_topic_idx').on(t.primaryTopicId),
  ],
);

export const userBookmarks = pgTable(
  'user_bookmarks',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, OWNED),
    postId: integer('post_id').notNull(),
    bookmarkedAt: text('bookmarked_at').notNull(),
    cardTitle: text('card_title').notNull(),
    sourceName: text('source_name').notNull(),
    url: text('url').notNull(),
    primaryTopicId: integer('primary_topic_id').references(() => topics.id, DETACH_ON_DELETE),
  },
  (t) => [
    unique('user_bookmarks_user_post_key').on(t.userId, t.postId),
    index('user_bookmarks_recent_idx').on(t.userId, t.bookmarkedAt.desc(), t.postId.desc()),
    index('user_bookmarks_primary_topic_idx').on(t.primaryTopicId),
  ],
);
