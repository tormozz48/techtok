import type { CompactFigure, Language, Topic } from '@techtok/shared';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { SqlClient } from '../clients/sqlClient';
import { decodeId, decodeIds, encodeId } from '../db/ids';
import {
  postCompacts,
  postFigures,
  posts,
  postTopics,
  postTranslations,
  sources,
  topics,
} from '../db/schema';
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

  async putIfNew(post: NewPost): Promise<string | undefined> {
    const now = new Date().toISOString();
    const insertTopics =
      post.topics.length > 0
        ? sql`, ins_topics as (
            insert into post_topics (post_id, topic_id)
            select ins_post.id, t.id from ins_post, topics t
            where t.slug in (${topicSlugs(post.topics)})
          )`
        : sql``;

    const result = await this.db.execute<{ id: number }>(sql`
      with ins_post as (
        insert into posts (
          url, canonical_url, source_id, orig_title, excerpt, image_url,
          primary_topic_id, status, transform, lang, s3_raw_key, duplicate_of_post_id,
          published_at, ingested_at, expires_at
        )
        select
          ${post.url}, ${post.canonicalUrl}, s.id, ${post.origTitle}, ${post.excerpt},
          ${post.imageUrl ?? null}, pt.id, ${post.status}::post_status,
          ${post.transform}::transform_kind, ${post.lang ?? null}, ${post.s3RawKey ?? null},
          ${post.duplicateOf ? decodeId(post.duplicateOf) : null}, ${post.publishedAt}, ${now},
          now() + interval '90 days'
        from sources s, topics pt
        where s.slug = ${post.sourceId} and pt.slug = ${post.primaryTopic}
        on conflict (canonical_url) do nothing
        returning id
      )${insertTopics}, ins_translation as (
        insert into post_translations (post_id, lang, card_title, summary, why_it_matters, translated_at)
        select id, ${BASE_LANGUAGE}::language, ${post.cardTitle}, ${post.summary},
          ${post.whyItMatters ?? null}, ${now}
        from ins_post
      )
      select id from ins_post
    `);
    const [row] = result.rows;
    return row ? encodeId(row.id) : undefined;
  }

  async queryByTopic(topic: Topic, opts: QueryOpts = {}): Promise<PostCandidate[]> {
    const rows = await this.db
      .select({
        id: posts.id,
        publishedAt: posts.publishedAt,
        primaryTopic: topics.slug,
        sourceId: sources.slug,
        origTitle: posts.origTitle,
        status: posts.status,
        duplicateOfPostId: posts.duplicateOfPostId,
        compactLangs: sql<Language[]>`coalesce((
          select json_agg(${postCompacts.lang}) from ${postCompacts}
          where ${postCompacts.postId} = ${posts.id}
        ), '[]'::json)`,
      })
      .from(posts)
      .innerJoin(topics, eq(posts.primaryTopicId, topics.id))
      .innerJoin(sources, eq(posts.sourceId, sources.id))
      .where(
        and(eq(topics.slug, topic), opts.before ? lt(posts.publishedAt, opts.before) : undefined),
      )
      .orderBy(desc(posts.publishedAt), desc(posts.id))
      .limit(opts.limit ?? DEFAULT_LIMIT);

    return rows.map(Post.toCandidate);
  }

  async queryRecent(opts: QueryOpts = {}): Promise<PostKey[]> {
    const rows = await this.db
      .select({ id: posts.id, publishedAt: posts.publishedAt })
      .from(posts)
      .where(opts.before ? lt(posts.publishedAt, opts.before) : undefined)
      .orderBy(desc(posts.publishedAt), desc(posts.id))
      .limit(opts.limit ?? DEFAULT_LIMIT);
    return rows.map((row) => ({ postId: encodeId(row.id), publishedAt: row.publishedAt }));
  }

  async getByIds(postIds: string[]): Promise<PostRecord[]> {
    const ids = decodeIds(postIds);
    if (ids.length === 0) return [];

    const [rows, dupCounts] = await Promise.all([
      this.db.query.posts.findMany({
        where: inArray(posts.id, ids),
        with: {
          source: { columns: { slug: true, name: true } },
          primaryTopic: true,
          translations: true,
          topics: { with: { topic: true } },
          compacts: true,
          figures: { orderBy: [asc(postFigures.position)] },
        },
      }),
      this.db
        .select({ duplicateOfPostId: posts.duplicateOfPostId, count: sql<number>`count(*)::int` })
        .from(posts)
        .where(inArray(posts.duplicateOfPostId, ids))
        .groupBy(posts.duplicateOfPostId),
    ]);

    const dupCountByOriginal = new Map(dupCounts.map((row) => [row.duplicateOfPostId, row.count]));
    return rows.map((row) => new Post(row, dupCountByOriginal.get(row.id)).toRecord());
  }

  async updateTransform(postId: string, fields: TransformUpdateFields): Promise<void> {
    const id = decodeId(postId);
    if (id === undefined) return;

    await this.db
      .update(posts)
      .set({
        status: fields.status,
        transform: fields.transform,
        ...(fields.excerpt !== undefined ? { excerpt: fields.excerpt } : {}),
        ...(fields.s3RawKey !== undefined ? { s3RawKey: fields.s3RawKey } : {}),
        ...(fields.primaryTopic !== undefined
          ? { primaryTopicId: topicIdOf(fields.primaryTopic) }
          : {}),
        ...(fields.lang !== undefined ? { lang: fields.lang } : {}),
        ...(fields.mirroredImageUrl !== undefined
          ? { mirroredImageUrl: fields.mirroredImageUrl }
          : {}),
        ...(fields.clearImageUrl ? { imageUrl: null } : {}),
      })
      .where(eq(posts.id, id));

    const cardPatch = {
      ...(fields.cardTitle !== undefined ? { cardTitle: fields.cardTitle } : {}),
      ...(fields.summary !== undefined ? { summary: fields.summary } : {}),
      ...(fields.whyItMatters !== undefined ? { whyItMatters: fields.whyItMatters } : {}),
    };
    if (Object.keys(cardPatch).length > 0) {
      await this.db
        .update(postTranslations)
        .set({ ...cardPatch, translatedAt: new Date().toISOString() })
        .where(and(eq(postTranslations.postId, id), eq(postTranslations.lang, BASE_LANGUAGE)));
    }

    if (fields.topics !== undefined) {
      await this.replaceTopics(id, fields.topics);
    }
  }

  async updateMirroredImage(postId: string, mirroredImageUrl: string): Promise<void> {
    const id = decodeId(postId);
    if (id === undefined) return;
    await this.db.update(posts).set({ mirroredImageUrl }).where(eq(posts.id, id));
  }

  async writeTranslation(postId: string, lang: Language, fields: TranslatedFields): Promise<void> {
    const id = decodeId(postId);
    if (id === undefined) return;
    const row = {
      postId: id,
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
    const id = decodeId(postId);
    if (id === undefined) return;
    await this.db.insert(postCompacts).values({ postId: id, lang }).onConflictDoNothing();
  }

  async setMirroredFigures(postId: string, figures: CompactFigure[]): Promise<void> {
    const id = decodeId(postId);
    if (id === undefined) return;
    await this.db.delete(postFigures).where(eq(postFigures.postId, id));
    if (figures.length === 0) return;
    await this.db
      .insert(postFigures)
      .values(
        figures.map((figure, position) => ({
          postId: id,
          position,
          url: figure.url,
          caption: figure.caption,
        })),
      )
      .onConflictDoUpdate({
        target: [postFigures.postId, postFigures.position],
        set: { url: sql`excluded.url`, caption: sql`excluded.caption` },
      });
  }

  async setDuplicateOf(postId: string, duplicateOf: string): Promise<void> {
    const id = decodeId(postId);
    const originalId = decodeId(duplicateOf);
    if (id === undefined || originalId === undefined) return;
    await this.db.update(posts).set({ duplicateOfPostId: originalId }).where(eq(posts.id, id));
  }

  async incrementDupCount(_postId: string): Promise<void> {
    return;
  }

  async deleteExpired(now: Date = new Date()): Promise<number> {
    const result = await this.db.delete(posts).where(lt(posts.expiresAt, now));
    return result.rowCount ?? 0;
  }

  private async replaceTopics(id: number, topicSlugList: Topic[]): Promise<void> {
    await this.db.delete(postTopics).where(eq(postTopics.postId, id));
    if (topicSlugList.length === 0) return;
    await this.db.execute(sql`
      insert into post_topics (post_id, topic_id)
      select ${id}, t.id from topics t where t.slug in (${topicSlugs(topicSlugList)})
    `);
  }
}

function topicIdOf(topic: Topic) {
  return sql<number>`(select id from ${topics} where ${topics.slug} = ${topic})`;
}

function topicSlugs(list: Topic[]) {
  return sql.join(
    list.map((topic) => sql`${topic}`),
    sql`, `,
  );
}
