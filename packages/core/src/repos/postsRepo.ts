import {
  type DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { CompactFigure, Language, Topic } from '@techtok/shared';
import { getUnixTime } from 'date-fns';
import { batchGetChunked, conditionalWrite, DYNAMO_BATCH_GET_LIMIT } from '../clients/dynamoClient';
import type {
  NewPost,
  PostCandidate,
  PostKey,
  PostRecord,
  PostStatus,
  TransformKind,
  TranslatedFields,
} from '../posts.types';

const POST_TTL_SECONDS = 90 * 24 * 60 * 60;
const BY_TIME_PARTITION = 'POST';

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
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async putIfNew(post: NewPost): Promise<boolean> {
    const now = new Date();
    const record: PostRecord & { gsi1pk: string } = {
      ...post,
      ingestedAt: now.toISOString(),
      ttl: getUnixTime(now) + POST_TTL_SECONDS,
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

  async queryByTopic(topic: Topic, opts: QueryOpts = {}): Promise<PostCandidate[]> {
    return this.queryNewestFirst<PostCandidate>('byTopic', 'primaryTopic', topic, opts);
  }

  async queryRecent(opts: QueryOpts = {}): Promise<PostKey[]> {
    return this.queryNewestFirst<PostKey>('byTime', 'gsi1pk', BY_TIME_PARTITION, opts);
  }

  async getByIds(postIds: string[]): Promise<PostRecord[]> {
    return batchGetChunked<string, PostRecord>(
      this.client,
      this.tableName,
      postIds,
      (postId) => ({ postId }),
      DYNAMO_BATCH_GET_LIMIT,
    );
  }

  async updateTransform(postId: string, fields: TransformUpdateFields): Promise<void> {
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

  async appendCompactLang(postId: string, lang: Language): Promise<void> {
    await conditionalWrite(() =>
      this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { postId },
          UpdateExpression:
            'SET #compactLangs = list_append(if_not_exists(#compactLangs, :empty), :lang)',
          ConditionExpression:
            'attribute_not_exists(#compactLangs) OR NOT contains(#compactLangs, :langValue)',
          ExpressionAttributeNames: { '#compactLangs': 'compactLangs' },
          ExpressionAttributeValues: { ':empty': [], ':lang': [lang], ':langValue': lang },
        }),
      ),
    );
  }

  async setMirroredFigures(postId: string, figures: CompactFigure[]): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { postId },
        UpdateExpression: 'SET #mirroredFigures = :figures',
        ExpressionAttributeNames: { '#mirroredFigures': 'mirroredFigures' },
        ExpressionAttributeValues: { ':figures': figures },
      }),
    );
  }

  async setDuplicateOf(postId: string, duplicateOf: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { postId },
        UpdateExpression: 'SET #duplicateOf = :duplicateOf',
        ExpressionAttributeNames: { '#duplicateOf': 'duplicateOf' },
        ExpressionAttributeValues: { ':duplicateOf': duplicateOf },
      }),
    );
  }

  async incrementDupCount(postId: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { postId },
        UpdateExpression: 'ADD #dupCount :one',
        ExpressionAttributeNames: { '#dupCount': 'dupCount' },
        ExpressionAttributeValues: { ':one': 1 },
      }),
    );
  }

  private async queryNewestFirst<T>(
    indexName: string,
    partitionKey: string,
    partitionValue: string,
    opts: QueryOpts,
  ): Promise<T[]> {
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
    return (result.Items ?? []) as T[];
  }
}
