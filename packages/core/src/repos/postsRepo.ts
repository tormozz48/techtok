import {
  BatchGetCommand,
  type DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Language, Topic } from '@techtok/shared';
import { conditionalWrite } from '../clients/dynamoClient';
import type {
  NewPost,
  PostRecord,
  PostStatus,
  TransformKind,
  TranslatedFields,
} from '../posts.types';
import { chunk } from '../util/chunk';

const POST_TTL_SECONDS = 90 * 24 * 60 * 60;
const BY_TIME_PARTITION = 'POST';
const BATCH_GET_CHUNK_SIZE = 100;

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
  /** D28: clears the ingest-time `imageUrl` when every image candidate
   * (ingest-time image, transform-time og:image) fails the minimum-dimension
   * quality gate — a plain `SET` omission leaves the existing stored value
   * untouched, so removing it needs its own `REMOVE` clause. */
  readonly clearImageUrl?: boolean;
}

export class PostsRepo {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async putIfNew(post: NewPost): Promise<boolean> {
    const now = new Date();
    const record: PostRecord & { gsi1pk: string } = {
      ...post,
      ingestedAt: now.toISOString(),
      ttl: Math.floor(now.getTime() / 1000) + POST_TTL_SECONDS,
      gsi1pk: BY_TIME_PARTITION,
      i18n: {},
      compactLangs: [],
    };

    return conditionalWrite(() =>
      this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: record,
          ConditionExpression: 'attribute_not_exists(postId)',
        }),
      ),
    );
  }

  async queryByTopic(topic: Topic, opts: QueryOpts = {}): Promise<PostRecord[]> {
    return this.queryNewestFirst('byTopic', 'primaryTopic', topic, opts);
  }

  async queryRecent(opts: QueryOpts = {}): Promise<PostRecord[]> {
    return this.queryNewestFirst('byTime', 'gsi1pk', BY_TIME_PARTITION, opts);
  }

  async getByIds(postIds: string[]): Promise<PostRecord[]> {
    if (postIds.length === 0) return [];

    const posts: PostRecord[] = [];
    for (const batch of chunk(postIds, BATCH_GET_CHUNK_SIZE)) {
      const result = await this.client.send(
        new BatchGetCommand({
          RequestItems: {
            [this.tableName]: { Keys: batch.map((postId) => ({ postId })) },
          },
        }),
      );
      posts.push(...((result.Responses?.[this.tableName] ?? []) as PostRecord[]));
    }
    return posts;
  }

  async updateTransform(postId: string, fields: TransformUpdateFields): Promise<void> {
    // Every attribute name is aliased via ExpressionAttributeNames, so
    // DynamoDB reserved words (status, transform, ...) can never break the
    // expression — this class of bug already bit twice (see CLAUDE.md).
    const { status, transform, clearImageUrl, ...optional } = fields;
    const assigned: Record<string, unknown> = { status, transform };
    for (const [name, value] of Object.entries(optional)) {
      if (value !== undefined) assigned[name] = value;
    }
    const names = Object.keys(assigned);

    const setClause = `SET ${names.map((name) => `#${name} = :${name}`).join(', ')}`;
    const removeClause = clearImageUrl ? ' REMOVE #imageUrl' : '';

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { postId },
        UpdateExpression: `${setClause}${removeClause}`,
        ExpressionAttributeNames: {
          ...Object.fromEntries(names.map((name) => [`#${name}`, name])),
          ...(clearImageUrl ? { '#imageUrl': 'imageUrl' } : {}),
        },
        ExpressionAttributeValues: Object.fromEntries(
          names.map((name) => [`:${name}`, assigned[name]]),
        ),
      }),
    );
  }

  /** Narrow update used only by the image backfill (phase 7 task 3) — unlike
   * `updateTransform`, this never touches `status`/`transform`, since the
   * backfill mines an image out of an already-`ready` post's archive without
   * re-running its transform. Attribute name is aliased for consistency with
   * `updateTransform`'s own hard-won lesson, even though `mirroredImageUrl`
   * isn't itself a reserved word. */
  async updateMirroredImage(postId: string, mirroredImageUrl: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { postId },
        UpdateExpression: 'SET #mirroredImageUrl = :mirroredImageUrl',
        ExpressionAttributeNames: { '#mirroredImageUrl': 'mirroredImageUrl' },
        ExpressionAttributeValues: { ':mirroredImageUrl': mirroredImageUrl },
      }),
    );
  }

  /** Writes a translation (D21/D27). */
  async writeTranslation(postId: string, lang: Language, fields: TranslatedFields): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { postId },
        UpdateExpression: 'SET #i18n.#lang = :fields',
        ExpressionAttributeNames: {
          '#i18n': 'i18n',
          '#lang': lang,
        },
        ExpressionAttributeValues: { ':fields': fields },
      }),
    );
  }

  /** Sets the full list of languages with a cached compact-article variant
   * (D23). The caller computes the deduped list from the post it already
   * fetched (`[...current, newLang]`) — at this table's low write volume a
   * plain overwrite is simpler than a conditional list-append and avoids
   * ever appending the same language twice. */
  async setCompactLangs(postId: string, langs: Language[]): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { postId },
        UpdateExpression: 'SET #compactLangs = :langs',
        ExpressionAttributeNames: { '#compactLangs': 'compactLangs' },
        ExpressionAttributeValues: { ':langs': langs },
      }),
    );
  }

  private async queryNewestFirst(
    indexName: string,
    partitionKey: string,
    partitionValue: string,
    opts: QueryOpts,
  ): Promise<PostRecord[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: indexName,
        KeyConditionExpression: opts.before ? '#pk = :pk AND publishedAt < :before' : '#pk = :pk',
        ExpressionAttributeNames: { '#pk': partitionKey },
        ExpressionAttributeValues: opts.before
          ? { ':pk': partitionValue, ':before': opts.before }
          : { ':pk': partitionValue },
        ScanIndexForward: false,
        Limit: opts.limit ?? 20,
      }),
    );
    return (result.Items ?? []) as PostRecord[];
  }
}
