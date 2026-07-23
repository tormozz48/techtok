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
      i18nPending: {},
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
    const { status, transform, ...optional } = fields;
    const assigned: Record<string, unknown> = { status, transform };
    for (const [name, value] of Object.entries(optional)) {
      if (value !== undefined) assigned[name] = value;
    }
    const names = Object.keys(assigned);

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { postId },
        UpdateExpression: `SET ${names.map((name) => `#${name} = :${name}`).join(', ')}`,
        ExpressionAttributeNames: Object.fromEntries(names.map((name) => [`#${name}`, name])),
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

  /** Stamps an enqueue-dedup marker (D22) while a translation is in flight on
   * `TranslateQueue`. Relies on `i18nPending` always existing as a (possibly
   * empty) map from `putIfNew`, so this nested SET never needs an
   * `if_not_exists` seed — see `needsTranslation` for the staleness check
   * that lets a stuck marker eventually retry. */
  async setI18nPending(postId: string, lang: Language, pendingAt: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { postId },
        UpdateExpression: 'SET #i18nPending.#lang = :pendingAt',
        ExpressionAttributeNames: { '#i18nPending': 'i18nPending', '#lang': lang },
        ExpressionAttributeValues: { ':pendingAt': pendingAt },
      }),
    );
  }

  /** Writes a translation and clears its pending marker atomically (D21/D22).
   * `i18n` and `i18nPending` are distinct top-level attributes, so this single
   * expression never trips DynamoDB's overlapping-document-path restriction. */
  async writeTranslation(postId: string, lang: Language, fields: TranslatedFields): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { postId },
        UpdateExpression: 'SET #i18n.#lang = :fields REMOVE #i18nPending.#lang',
        ExpressionAttributeNames: {
          '#i18n': 'i18n',
          '#i18nPending': 'i18nPending',
          '#lang': lang,
        },
        ExpressionAttributeValues: { ':fields': fields },
      }),
    );
  }

  /** Clears a pending marker without writing a translation — the degrade path
   * for an over-cap or content-level translation failure (D22): English
   * stays the resting state, nothing else changes. */
  async clearI18nPending(postId: string, lang: Language): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { postId },
        UpdateExpression: 'REMOVE #i18nPending.#lang',
        ExpressionAttributeNames: { '#i18nPending': 'i18nPending', '#lang': lang },
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
