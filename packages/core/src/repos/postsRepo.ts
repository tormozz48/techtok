import type { CompactFigure, Language, Topic } from '@techtok/shared';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { SqlClient } from '../clients/sqlClient';
import { postCompacts, postFigures, posts, postTopics, postTranslations } from '../db/schema';
import { Post } from '../models/post';
import type {
  NewPost,
  PostCandidate,
  PostKey,
  PostRecord,
  PostStatus,
  TransformKind,
  TranslatedFields,
} from '../posts.types';

const BASE_LANGUAGE = 'en';

const DEFAULT_LIMIT = 20;

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
    const insertTopics =
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
      )${insertTopics}, ins_translation as (
        insert into post_translations (post_id, lang, card_title, summary, why_it_matters, translated_at)
        select post_id, ${BASE_LANGUAGE}::language, ${post.cardTitle}, ${post.summary},
          ${post.whyItMatters ?? null}, ${now}
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
        compactLangs: sql<Language[]>`coalesce((
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
      .limit(opts.limit ?? DEFAULT_LIMIT);

    return rows.map(Post.toCandidate);
  }

  async queryRecent(opts: QueryOpts = {}): Promise<PostKey[]> {
    return this.db
      .select({ postId: posts.postId, publishedAt: posts.publishedAt })
      .from(posts)
      .where(opts.before ? lt(posts.publishedAt, opts.before) : undefined)
      .orderBy(desc(posts.publishedAt), desc(posts.postId))
      .limit(opts.limit ?? DEFAULT_LIMIT);
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
    return rows.map((row) => new Post(row, dupCountByOriginal.get(row.postId)).toRecord());
  }

  async updateTransform(postId: string, fields: TransformUpdateFields): Promise<void> {
    await this.db
      .update(posts)
      .set({
        status: fields.status,
        transform: fields.transform,
        ...(fields.excerpt !== undefined ? { excerpt: fields.excerpt } : {}),
        ...(fields.s3RawKey !== undefined ? { s3RawKey: fields.s3RawKey } : {}),
        ...(fields.primaryTopic !== undefined ? { primaryTopic: fields.primaryTopic } : {}),
        ...(fields.lang !== undefined ? { lang: fields.lang } : {}),
        ...(fields.mirroredImageUrl !== undefined
          ? { mirroredImageUrl: fields.mirroredImageUrl }
          : {}),
        ...(fields.clearImageUrl ? { imageUrl: null } : {}),
      })
      .where(eq(posts.postId, postId));

    const cardPatch = {
      ...(fields.cardTitle !== undefined ? { cardTitle: fields.cardTitle } : {}),
      ...(fields.summary !== undefined ? { summary: fields.summary } : {}),
      ...(fields.whyItMatters !== undefined ? { whyItMatters: fields.whyItMatters } : {}),
    };
    if (Object.keys(cardPatch).length > 0) {
      await this.db
        .update(postTranslations)
        .set({ ...cardPatch, translatedAt: new Date().toISOString() })
        .where(and(eq(postTranslations.postId, postId), eq(postTranslations.lang, BASE_LANGUAGE)));
    }

    if (fields.topics !== undefined) {
      await this.replaceTopics(postId, fields.topics);
    }
  }

  async updateMirroredImage(postId: string, mirroredImageUrl: string): Promise<void> {
    await this.db.update(posts).set({ mirroredImageUrl }).where(eq(posts.postId, postId));
  }

  async writeTranslation(postId: string, lang: Language, fields: TranslatedFields): Promise<void> {
    const row = {
      postId,
      lang,
      cardTitle: fields.cardTitle,
      summary: fields.summary,
      whyItMatters: fields.whyItMatters ?? null,
      translatedAt: fields.translatedAt,
    };
    await this.db
      .insert(postTranslations)
      .values(row)
      .onConflictDoUpdate({ target: [postTranslations.postId, postTranslations.lang], set: row });
  }

  async appendCompactLang(postId: string, lang: Language): Promise<void> {
    await this.db.insert(postCompacts).values({ postId, lang }).onConflictDoNothing();
  }

  async setMirroredFigures(postId: string, figures: CompactFigure[]): Promise<void> {
    await this.db.delete(postFigures).where(eq(postFigures.postId, postId));
    if (figures.length === 0) return;
    await this.db.insert(postFigures).values(
      figures.map((figure, position) => ({
        postId,
        position,
        url: figure.url,
        caption: figure.caption,
      })),
    );
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

  private async replaceTopics(postId: string, topics: Topic[]): Promise<void> {
    await this.db.delete(postTopics).where(eq(postTopics.postId, postId));
    if (topics.length === 0) return;
    await this.db.insert(postTopics).values(topics.map((topic) => ({ postId, topic })));
  }
}
