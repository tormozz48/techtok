import type { Language, Topic } from '@techtok/shared';
import { LANGUAGES, TOPICS } from '@techtok/shared';
import type { EntitlementSource } from '../../packages/core/src/entitlement/entitlement.types';
import type { PostStatus, TransformKind } from '../../packages/core/src/posts.types';

type EntitlementPlan = 'free' | 'plus';
type FetchStatus = 'ok' | 'not-modified' | 'error';

const VALID_TOPICS = new Set<string>(TOPICS);
const VALID_LANGUAGES = new Set<string>(LANGUAGES);
const VALID_STATUSES = new Set<string>(['discovered', 'ready', 'failed']);
const VALID_TRANSFORMS = new Set<string>(['llm', 'excerpt']);
const VALID_FETCH_STATUSES = new Set<string>(['ok', 'not-modified', 'error']);
const VALID_ENTITLEMENT_PLANS = new Set<string>(['free', 'plus']);
const VALID_ENTITLEMENT_SOURCES = new Set<string>(['manual', 'play']);

export interface SourceRow {
  sourceId: string;
  name: string;
  rssUrl: string;
  siteUrl: string | null;
  defaultTopic: Topic;
  weight: number;
  enabled: boolean;
  compactEnabled: boolean | null;
  etag: string | null;
  lastModified: string | null;
  lastFetchAt: string | null;
  lastStatus: FetchStatus | null;
  newestSeenPublishedAt: string | null;
  failCount: number;
}

export interface PostRows {
  post: {
    postId: string;
    url: string;
    canonicalUrl: string;
    sourceId: string;
    origTitle: string;
    excerpt: string;
    imageUrl: string | null;
    mirroredImageUrl: string | null;
    primaryTopic: Topic;
    status: PostStatus;
    transform: TransformKind;
    lang: string | null;
    s3RawKey: string | null;
    duplicateOf: string | null;
    publishedAt: string;
    ingestedAt: string;
    expiresAt: Date;
  };
  translations: {
    postId: string;
    lang: Language;
    cardTitle: string;
    summary: string;
    whyItMatters: string | null;
    translatedAt: string;
  }[];
  topics: { postId: string; topic: Topic }[];
  compacts: { postId: string; lang: Language }[];
  figures: { postId: string; position: number; url: string; caption: string | null }[];
}

export interface UserRows {
  user: {
    userId: string;
    createdAt: string;
    lastSeenAt: string;
    language: Language | null;
    timezone: string | null;
    email: string | null;
    name: string | null;
  };
  topics: { userId: string; topic: Topic }[];
  mutedSources: { userId: string; sourceId: string }[];
  topicReads: { userId: string; topic: Topic; readCount: number }[];
  quota: { userId: string; day: string; cardReads: number; readerOpens: number } | null;
  entitlement: {
    userId: string;
    plan: EntitlementPlan;
    source: EntitlementSource;
    expiresAt: string | null;
    productId: string | null;
    purchaseToken: string | null;
    verifiedAt: string;
  } | null;
}

export interface ActivityRow {
  userId: string;
  postId: string;
  at: string;
  cardTitle: string;
  sourceName: string;
  url: string;
  primaryTopic: Topic | null;
}

export interface TransformResult<T> {
  row: T | null;
  violations: string[];
  notes: string[];
}

export function transformSource(item: Record<string, unknown>): TransformResult<SourceRow> {
  const violations: string[] = [];
  const sourceId = asString(item.sourceId);
  if (!sourceId) violations.push('missing sourceId');
  const defaultTopic = asString(item.defaultTopic);
  if (!defaultTopic || !isTopic(defaultTopic)) {
    violations.push(`invalid defaultTopic: ${String(item.defaultTopic)}`);
  }
  const lastStatusRaw = asString(item.lastStatus);
  if (lastStatusRaw !== undefined && !isFetchStatus(lastStatusRaw)) {
    violations.push(`invalid lastStatus: ${lastStatusRaw}`);
  }
  if (violations.length > 0 || !sourceId || !defaultTopic || !isTopic(defaultTopic)) {
    return { row: null, violations, notes: [] };
  }

  return {
    row: {
      sourceId,
      name: asString(item.name) ?? sourceId,
      rssUrl: asString(item.rssUrl) ?? '',
      siteUrl: asString(item.siteUrl) ?? null,
      defaultTopic,
      weight: typeof item.weight === 'number' ? item.weight : 1,
      enabled: item.enabled !== false,
      compactEnabled: typeof item.compactEnabled === 'boolean' ? item.compactEnabled : null,
      etag: asString(item.etag) ?? null,
      lastModified: asString(item.lastModified) ?? null,
      lastFetchAt: asString(item.lastFetchAt) ?? null,
      lastStatus: lastStatusRaw && isFetchStatus(lastStatusRaw) ? lastStatusRaw : null,
      newestSeenPublishedAt: asString(item.newestSeenPublishedAt) ?? null,
      failCount: typeof item.failCount === 'number' ? item.failCount : 0,
    },
    violations: [],
    notes: [],
  };
}

export function transformPost(
  item: Record<string, unknown>,
  validSourceIds: ReadonlySet<string>,
): TransformResult<PostRows> {
  const violations: string[] = [];
  const postId = asString(item.postId);
  if (!postId) violations.push('missing postId');
  const primaryTopic = asString(item.primaryTopic);
  if (!primaryTopic || !isTopic(primaryTopic)) {
    violations.push(`invalid primaryTopic: ${String(item.primaryTopic)}`);
  }
  const status = asString(item.status);
  if (!status || !isPostStatus(status)) violations.push(`invalid status: ${String(item.status)}`);
  const transform = asString(item.transform);
  if (!transform || !isTransformKind(transform)) {
    violations.push(`invalid transform: ${String(item.transform)}`);
  }
  const sourceId = asString(item.sourceId);
  if (!sourceId) violations.push('missing sourceId');
  else if (!validSourceIds.has(sourceId)) violations.push(`unknown sourceId: ${sourceId}`);
  const publishedAt = asString(item.publishedAt);
  if (!publishedAt) violations.push('missing publishedAt');
  const url = asString(item.url);
  const canonicalUrl = asString(item.canonicalUrl);
  const origTitle = asString(item.origTitle);
  const excerpt = asString(item.excerpt);
  if (!url || !canonicalUrl || !origTitle || excerpt === undefined) {
    violations.push('missing one of url/canonicalUrl/origTitle/excerpt');
  }

  const topicsRaw = Array.isArray(item.topics) ? item.topics.map(String) : [];
  const invalidTopics = topicsRaw.filter((t) => !isTopic(t));
  if (invalidTopics.length > 0) {
    violations.push(`invalid topics entries: ${invalidTopics.join(', ')}`);
  }

  const i18nRaw = isPlainObject(item.i18n) ? item.i18n : {};
  const invalidLangs = Object.keys(i18nRaw).filter((l) => l !== 'en' && !isLanguage(l));
  if (invalidLangs.length > 0) violations.push(`invalid i18n keys: ${invalidLangs.join(', ')}`);

  const compactLangsRaw = Array.isArray(item.compactLangs) ? item.compactLangs.map(String) : [];
  const invalidCompactLangs = compactLangsRaw.filter((l) => !isLanguage(l));
  if (invalidCompactLangs.length > 0) {
    violations.push(`invalid compactLangs entries: ${invalidCompactLangs.join(', ')}`);
  }

  if (
    violations.length > 0 ||
    !postId ||
    !primaryTopic ||
    !isTopic(primaryTopic) ||
    !status ||
    !isPostStatus(status) ||
    !transform ||
    !isTransformKind(transform) ||
    !sourceId ||
    !publishedAt ||
    !url ||
    !canonicalUrl ||
    !origTitle ||
    excerpt === undefined
  ) {
    return { row: null, violations, notes: [] };
  }

  const ingestedAt = asString(item.ingestedAt) ?? publishedAt;
  const ttl = typeof item.ttl === 'number' ? item.ttl : undefined;
  const expiresAt = ttl ? new Date(ttl * 1000) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const translations: PostRows['translations'] = [
    {
      postId,
      lang: 'en',
      cardTitle: asString(item.cardTitle) ?? origTitle,
      summary: asString(item.summary) ?? excerpt,
      whyItMatters: asString(item.whyItMatters) ?? null,
      translatedAt: ingestedAt,
    },
    ...Object.entries(i18nRaw)
      .filter((entry): entry is [Language, unknown] => entry[0] !== 'en' && isLanguage(entry[0]))
      .map(([lang, fields]) => {
        const f = isPlainObject(fields) ? fields : {};
        return {
          postId,
          lang,
          cardTitle: asString(f.cardTitle) ?? '',
          summary: asString(f.summary) ?? '',
          whyItMatters: asString(f.whyItMatters) ?? null,
          translatedAt: asString(f.translatedAt) ?? ingestedAt,
        };
      }),
  ];

  const figuresRaw = Array.isArray(item.mirroredFigures) ? item.mirroredFigures : [];

  return {
    row: {
      post: {
        postId,
        url,
        canonicalUrl,
        sourceId,
        origTitle,
        excerpt,
        imageUrl: asString(item.imageUrl) ?? null,
        mirroredImageUrl: asString(item.mirroredImageUrl) ?? null,
        primaryTopic,
        status,
        transform,
        lang: asString(item.lang) ?? null,
        s3RawKey: asString(item.s3RawKey) ?? null,
        duplicateOf: asString(item.duplicateOf) ?? null,
        publishedAt,
        ingestedAt,
        expiresAt,
      },
      translations,
      topics: topicsRaw.filter(isTopic).map((topic) => ({ postId, topic })),
      compacts: compactLangsRaw.filter(isLanguage).map((lang) => ({ postId, lang })),
      figures: figuresRaw.map((figure, position) => {
        const f = isPlainObject(figure) ? figure : {};
        return {
          postId,
          position,
          url: asString(f.url) ?? '',
          caption: asString(f.caption) ?? null,
        };
      }),
    },
    violations: [],
    notes: [],
  };
}

export function dropDanglingDuplicates(rows: PostRows[]): { rows: PostRows[]; notes: string[] } {
  const validPostIds = new Set(rows.map((r) => r.post.postId));
  const notes: string[] = [];
  const fixed = rows.map((r) => {
    if (!r.post.duplicateOf || validPostIds.has(r.post.duplicateOf)) return r;
    notes.push(
      `post ${r.post.postId}: dropped duplicateOf reference to ${r.post.duplicateOf}, which is not among the migrating posts`,
    );
    return { ...r, post: { ...r.post, duplicateOf: null } };
  });
  return { rows: fixed, notes };
}

export function transformUser(item: Record<string, unknown>): TransformResult<UserRows> {
  const violations: string[] = [];
  const userId = asString(item.userId);
  if (!userId) violations.push('missing userId');
  const language = asString(item.language);
  if (language !== undefined && !isLanguage(language)) {
    violations.push(`invalid language: ${language}`);
  }

  const entitlementRaw = isPlainObject(item.entitlement) ? item.entitlement : undefined;
  let entitlementPlan: EntitlementPlan | undefined;
  let entitlementSource: EntitlementSource | undefined;
  if (entitlementRaw) {
    const plan = asString(entitlementRaw.plan);
    const source = asString(entitlementRaw.source);
    if (!plan || !isEntitlementPlan(plan)) {
      violations.push(`invalid entitlement.plan: ${plan}`);
    } else {
      entitlementPlan = plan;
    }
    if (!source || !isEntitlementSource(source)) {
      violations.push(`invalid entitlement.source: ${source}`);
    } else {
      entitlementSource = source;
    }
  }

  if (violations.length > 0 || !userId) return { row: null, violations, notes: [] };

  const createdAt = asString(item.createdAt) ?? new Date().toISOString();
  const topicsRaw = Array.isArray(item.topics) ? item.topics.map(String) : [];
  const mutedSourcesRaw = Array.isArray(item.mutedSources) ? item.mutedSources.map(String) : [];
  const topicReadsRaw = isPlainObject(item.topicReads) ? item.topicReads : {};
  const quotaRaw = isPlainObject(item.quota) ? item.quota : undefined;

  return {
    row: {
      user: {
        userId,
        createdAt,
        lastSeenAt: asString(item.lastSeenAt) ?? createdAt,
        language: language && isLanguage(language) ? language : null,
        timezone: asString(item.timezone) ?? null,
        email: asString(item.email) ?? null,
        name: asString(item.name) ?? null,
      },
      topics: topicsRaw.filter(isTopic).map((topic) => ({ userId, topic })),
      mutedSources: mutedSourcesRaw.map((sourceId) => ({ userId, sourceId })),
      topicReads: Object.entries(topicReadsRaw)
        .filter((entry): entry is [Topic, unknown] => isTopic(entry[0]))
        .map(([topic, count]) => ({
          userId,
          topic,
          readCount: typeof count === 'number' ? count : 0,
        })),
      quota: quotaRaw
        ? {
            userId,
            day: asString(quotaRaw.day) ?? '',
            cardReads: typeof quotaRaw.cardReads === 'number' ? quotaRaw.cardReads : 0,
            readerOpens: typeof quotaRaw.readerOpens === 'number' ? quotaRaw.readerOpens : 0,
          }
        : null,
      entitlement:
        entitlementRaw && entitlementPlan && entitlementSource
          ? {
              userId,
              plan: entitlementPlan,
              source: entitlementSource,
              expiresAt: asString(entitlementRaw.expiresAt) ?? null,
              productId: asString(entitlementRaw.productId) ?? null,
              purchaseToken: asString(entitlementRaw.purchaseToken) ?? null,
              verifiedAt: asString(entitlementRaw.verifiedAt) ?? createdAt,
            }
          : null,
    },
    violations: [],
    notes: [],
  };
}

export function transformActivity(item: Record<string, unknown>): TransformResult<ActivityRow> {
  const violations: string[] = [];
  const userId = asString(item.userId);
  const postId = asString(item.postId);
  const at = asString(item.readAt) ?? asString(item.bookmarkedAt);
  const snapshot = isPlainObject(item.snapshot) ? item.snapshot : {};
  const cardTitle = asString(snapshot.cardTitle);
  const sourceName = asString(snapshot.sourceName);
  const url = asString(snapshot.url);

  if (!userId) violations.push('missing userId');
  if (!postId) violations.push('missing postId');
  if (!at) violations.push('missing readAt/bookmarkedAt');
  if (cardTitle === undefined || sourceName === undefined || url === undefined) {
    violations.push('missing one of snapshot.cardTitle/sourceName/url');
  }
  if (
    violations.length > 0 ||
    !userId ||
    !postId ||
    !at ||
    cardTitle === undefined ||
    sourceName === undefined ||
    url === undefined
  ) {
    return { row: null, violations, notes: [] };
  }

  const primaryTopic = asString(snapshot.primaryTopic);
  return {
    row: {
      userId,
      postId,
      at,
      cardTitle,
      sourceName,
      url,
      primaryTopic: primaryTopic && isTopic(primaryTopic) ? primaryTopic : null,
    },
    violations: [],
    notes: [],
  };
}

export function isReadRow(item: Record<string, unknown>): boolean {
  return typeof item.sk === 'string' && item.sk.startsWith('read#');
}

export function isBookmarkRow(item: Record<string, unknown>): boolean {
  return typeof item.sk === 'string' && item.sk.startsWith('bm#');
}

function isTopic(value: string): value is Topic {
  return VALID_TOPICS.has(value);
}

function isLanguage(value: string): value is Language {
  return VALID_LANGUAGES.has(value);
}

function isPostStatus(value: string): value is PostStatus {
  return VALID_STATUSES.has(value);
}

function isTransformKind(value: string): value is TransformKind {
  return VALID_TRANSFORMS.has(value);
}

function isFetchStatus(value: string): value is FetchStatus {
  return VALID_FETCH_STATUSES.has(value);
}

function isEntitlementPlan(value: string): value is EntitlementPlan {
  return VALID_ENTITLEMENT_PLANS.has(value);
}

function isEntitlementSource(value: string): value is EntitlementSource {
  return VALID_ENTITLEMENT_SOURCES.has(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
