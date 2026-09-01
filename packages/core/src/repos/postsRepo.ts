import type { CompactFigure, Language, Topic } from '@techtok/shared';
import { getUnixTime } from 'date-fns';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { SqlClient } from '../clients/sqlClient';
import { postCompacts, postFigures, posts, postTopics, postTranslations } from '../db/schema';
import type {
  NewPost,
  PostCandidate,
  PostKey,
  PostRecord,
  PostStatus,
  TransformKind,
  TranslatedFields,
} from '../posts.types';

export interface QueryOpts {
  readonly before?: string;
  readonly limit?: number;
}

export interface TransformUpdateFields {
  readonly status: PostStatus;
  readonly transform: TransformKind;
  readonly summary?: string;
  readonly excerpt?: string;
  readonly s3RawKey?: string;
  readonly cardTitle?: string;
  readonly whyItMatters?: string;
  readonly primaryTopic?: Topic;
  readonly topics?: Topic[];
  readonly lang?: string;
  readonly mirroredImageUrl?: string;
  readonly clearImageUrl?: boolean;
}

export class PostsRepo {
  constructor(private readonly db: SqlClient) {}

  async putIfNew(post: NewPost): Promise<boolean> {
    const now = new Date().toISOString();
    const topicsFragment =
      post.topics.length > 0
        ? sql`, ins_topics as (
            insert into post_topics (post_id, topic)
            select post_id, v.topic from ins_post,
              (values ${sql.join(
                post.topics.map((topic) => sql`(${topic}::topic)`),
                sql`, `,
              )}) as v(topic)
          )`
        : sql``;

    const result = await this.db.execute(sql`
      with ins_post as (
        insert into posts (
          post_id, url, canonical_url, source_id, orig_title, excerpt, image_url,
          primary_topic, status, transform, lang, s3_raw_key, duplicate_of,
          published_at, ingested_at, expires_at
        )
        values (
          ${post.postId}, ${post.url}, ${post.canonicalUrl}, ${post.sourceId}, ${post.origTitle},
          ${post.excerpt}, ${post.imageUrl ?? null}, ${post.primaryTopic}::topic,
          ${post.status}::post_status, ${post.transform}::transform_kind, ${post.lang ?? null},
          ${post.s3RawKey ?? null}, ${post.duplicateOf ?? null}, ${post.publishedAt}, ${now},
          now() + interval '90 days'
        )
        on conflict (post_id) do nothing
        returning post_id
      )${topicsFragment}, ins_translation as (
        insert into post_translations (post_id, lang, card_title, summary, why_it_matters, translated_at)
        select post_id, 'en', ${post.cardTitle}, ${post.summary}, ${post.whyItMatters ?? null}, ${now}
        from ins_post
      )
      select post_id from ins_post
    `);
    return result.rows.length > 0;
  }

  async queryByTopic(topic: Topic, opts: QueryOpts = {}): Promise<PostCandidate[]> {
    const rows = await this.db
      .select({
        postId: posts.postId,
        publishedAt: posts.publishedAt,
        primaryTopic: posts.primaryTopic,
        sourceId: posts.sourceId,
        origTitle: posts.origTitle,
        status: posts.status,
        duplicateOf: posts.duplicateOf,
        compactLangs: sql<string[]>`coalesce((
          select json_agg(${postCompacts.lang}) from ${postCompacts}
          where ${postCompacts.postId} = ${posts.postId}
        ), '[]'::json)`,
      })
      .from(posts)
      .where(
        and(
          eq(posts.primaryTopic, topic),
          opts.before ? lt(posts.publishedAt, opts.before) : undefined,
        ),
      )
      .orderBy(desc(posts.publishedAt), desc(posts.postId))
      .limit(opts.limit ?? 20);

    return rows.map((row) => ({
      postId: row.postId,
      publishedAt: row.publishedAt,
      primaryTopic: row.primaryTopic,
      sourceId: row.sourceId,
      origTitle: row.origTitle,
      status: row.status,
      compactLangs: row.compactLangs.length > 0 ? (row.compactLangs as Language[]) : undefined,
      duplicateOf: row.duplicateOf ?? undefined,
    }));
  }

  async queryRecent(opts: QueryOpts = {}): Promise<PostKey[]> {
    return this.db
      .select({ postId: posts.postId, publishedAt: posts.publishedAt })
      .from(posts)
      .where(opts.before ? lt(posts.publishedAt, opts.before) : undefined)
      .orderBy(desc(posts.publishedAt), desc(posts.postId))
      .limit(opts.limit ?? 20);
  }

  async getByIds(postIds: string[]): Promise<PostRecord[]> {
    if (postIds.length === 0) return [];

    const [rows, dupCounts] = await Promise.all([
      this.db.query.posts.findMany({
        where: inArray(posts.postId, postIds),
        with: {
          source: { columns: { name: true } },
          translations: true,
          topics: true,
          compacts: true,
          figures: { orderBy: [asc(postFigures.position)] },
        },
      }),
      this.db
        .select({ duplicateOf: posts.duplicateOf, count: sql<number>`count(*)::int` })
        .from(posts)
        .where(inArray(posts.duplicateOf, postIds))
        .groupBy(posts.duplicateOf),
    ]);

    const dupCountByOriginal = new Map(dupCounts.map((row) => [row.duplicateOf, row.count]));
    return rows.map((row) => toPostRecord(row, dupCountByOriginal.get(row.postId)));
  }

  async updateTransform(postId: string, fields: TransformUpdateFields): Promise<void> {
    const {
      status,
      transform,
      summary,
      excerpt,
      s3RawKey,
      cardTitle,
      whyItMatters,
      primaryTopic,
      topics,
      lang,
      mirroredImageUrl,
      clearImageUrl,
    } = fields;

    const postsPatch: Partial<typeof posts.$inferInsert> = { status, transform };
    if (excerpt !== undefined) postsPatch.excerpt = excerpt;
    if (s3RawKey !== undefined) postsPatch.s3RawKey = s3RawKey;
    if (primaryTopic !== undefined) postsPatch.primaryTopic = primaryTopic;
    if (lang !== undefined) postsPatch.lang = lang;
    if (mirroredImageUrl !== undefined) postsPatch.mirroredImageUrl = mirroredImageUrl;
    if (clearImageUrl) postsPatch.imageUrl = null;
    await this.db.update(posts).set(postsPatch).where(eq(posts.postId, postId));

    if (cardTitle !== undefined || summary !== undefined || whyItMatters !== undefined) {
      const translationPatch: Partial<typeof postTranslations.$inferInsert> = {
        translatedAt: new Date().toISOString(),
      };
      if (cardTitle !== undefined) translationPatch.cardTitle = cardTitle;
      if (summary !== undefined) translationPatch.summary = summary;
      if (whyItMatters !== undefined) translationPatch.whyItMatters = whyItMatters;
      await this.db
        .update(postTranslations)
        .set(translationPatch)
        .where(and(eq(postTranslations.postId, postId), eq(postTranslations.lang, 'en')));
    }

    if (topics !== undefined) {
      await this.db.delete(postTopics).where(eq(postTopics.postId, postId));
      if (topics.length > 0) {
        await this.db.insert(postTopics).values(topics.map((topic) => ({ postId, topic })));
      }
    }
  }

  async updateMirroredImage(postId: string, mirroredImageUrl: string): Promise<void> {
    await this.db.update(posts).set({ mirroredImageUrl }).where(eq(posts.postId, postId));
  }

  async writeTranslation(postId: string, lang: Language, fields: TranslatedFields): Promise<void> {
    await this.db
      .insert(postTranslations)
      .values({
        postId,
        lang,
        cardTitle: fields.cardTitle,
        summary: fields.summary,
        whyItMatters: fields.whyItMatters,
        translatedAt: fields.translatedAt,
      })
      .onConflictDoUpdate({
        target: [postTranslations.postId, postTranslations.lang],
        set: {
          cardTitle: fields.cardTitle,
          summary: fields.summary,
          whyItMatters: fields.whyItMatters ?? null,
          translatedAt: fields.translatedAt,
        },
      });
  }

  async appendCompactLang(postId: string, lang: Language): Promise<void> {
    await this.db.insert(postCompacts).values({ postId, lang }).onConflictDoNothing();
  }

  async setMirroredFigures(postId: string, figures: CompactFigure[]): Promise<void> {
    await this.db.delete(postFigures).where(eq(postFigures.postId, postId));
    if (figures.length > 0) {
      await this.db.insert(postFigures).values(
        figures.map((figure, position) => ({
          postId,
          position,
          url: figure.url,
          caption: figure.caption,
        })),
      );
    }
  }

  async setDuplicateOf(postId: string, duplicateOf: string): Promise<void> {
    await this.db.update(posts).set({ duplicateOf }).where(eq(posts.postId, postId));
  }

  async incrementDupCount(_postId: string): Promise<void> {
    return;
  }

  async deleteExpired(now: Date = new Date()): Promise<number> {
    const result = await this.db.delete(posts).where(lt(posts.expiresAt, now));
    return result.rowCount ?? 0;
  }
}

function toPostRecord(
  row: {
    postId: string;
    url: string;
    canonicalUrl: string;
    sourceId: string;
    source: { name: string } | null;
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
    translations: {
      lang: Language;
      cardTitle: string;
      summary: string;
      whyItMatters: string | null;
      translatedAt: string;
    }[];
    topics: { topic: Topic }[];
    compacts: { lang: Language }[];
    figures: { url: string; caption: string | null }[];
  },
  dupCount: number | undefined,
): PostRecord {
  const enTranslation = row.translations.find((t) => t.lang === 'en');
  const i18n: PostRecord['i18n'] = {};
  for (const translation of row.translations) {
    if (translation.lang === 'en') continue;
    i18n[translation.lang] = {
      cardTitle: translation.cardTitle,
      summary: translation.summary,
      whyItMatters: translation.whyItMatters ?? undefined,
      translatedAt: translation.translatedAt,
    };
  }

  return {
    postId: row.postId,
    url: row.url,
    canonicalUrl: row.canonicalUrl,
    sourceId: row.sourceId,
    sourceName: row.source?.name ?? '',
    origTitle: row.origTitle,
    cardTitle: enTranslation?.cardTitle ?? '',
    summary: enTranslation?.summary ?? '',
    whyItMatters: enTranslation?.whyItMatters ?? undefined,
    excerpt: row.excerpt,
    imageUrl: row.imageUrl ?? undefined,
    primaryTopic: row.primaryTopic,
    topics: row.topics.map((t) => t.topic),
    status: row.status,
    transform: row.transform,
    publishedAt: row.publishedAt,
    s3RawKey: row.s3RawKey ?? undefined,
    lang: row.lang ?? undefined,
    duplicateOf: row.duplicateOf ?? undefined,
    ingestedAt: row.ingestedAt,
    ttl: getUnixTime(row.expiresAt),
    mirroredImageUrl: row.mirroredImageUrl ?? undefined,
    i18n,
    compactLangs: row.compacts.length > 0 ? row.compacts.map((c) => c.lang) : undefined,
    mirroredFigures:
      row.figures.length > 0
        ? row.figures.map((f) => ({ url: f.url, caption: f.caption ?? undefined }))
        : undefined,
    dupCount,
  };
}
