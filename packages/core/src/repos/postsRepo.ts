import {
  BatchGetCommand,
  type DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Topic } from '@techtok/shared';
import type { NewPost, PostRecord, PostStatus, TransformKind } from '../posts/types';
import { chunk } from '../util/chunk';
import { conditionalWrite } from './dynamoClient';

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
