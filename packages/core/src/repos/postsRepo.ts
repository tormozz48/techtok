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
  before?: string;
  limit?: number;
}

export interface TransformUpdateFields {
  status: PostStatus;
  transform: TransformKind;
  summary?: string;
  excerpt?: string;
  s3RawKey?: string;
  cardTitle?: string;
  whyItMatters?: string;
  primaryTopic?: Topic;
  topics?: Topic[];
  lang?: string;
  mirroredImageUrl?: string;
}

export interface PostsRepo {
  putIfNew(post: NewPost): Promise<boolean>;
  queryByTopic(topic: Topic, opts?: QueryOpts): Promise<PostRecord[]>;
  queryRecent(opts?: QueryOpts): Promise<PostRecord[]>;
  getByIds(postIds: string[]): Promise<PostRecord[]>;
  updateTransform(postId: string, fields: TransformUpdateFields): Promise<void>;
}

export function createPostsRepo(client: DynamoDBDocumentClient, tableName: string): PostsRepo {
  async function queryNewestFirst(
    indexName: string,
    partitionKey: string,
    partitionValue: string,
    opts: QueryOpts,
  ): Promise<PostRecord[]> {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
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

  return {
    async putIfNew(post: NewPost): Promise<boolean> {
      const now = new Date();
      const record: PostRecord & { gsi1pk: string } = {
        ...post,
        ingestedAt: now.toISOString(),
        ttl: Math.floor(now.getTime() / 1000) + POST_TTL_SECONDS,
        gsi1pk: BY_TIME_PARTITION,
      };

      return conditionalWrite(() =>
        client.send(
          new PutCommand({
            TableName: tableName,
            Item: record,
            ConditionExpression: 'attribute_not_exists(postId)',
          }),
        ),
      );
    },

    async queryByTopic(topic: Topic, opts: QueryOpts = {}): Promise<PostRecord[]> {
      return queryNewestFirst('byTopic', 'primaryTopic', topic, opts);
    },

    async queryRecent(opts: QueryOpts = {}): Promise<PostRecord[]> {
      return queryNewestFirst('byTime', 'gsi1pk', BY_TIME_PARTITION, opts);
    },

    async getByIds(postIds: string[]): Promise<PostRecord[]> {
      if (postIds.length === 0) return [];

      const posts: PostRecord[] = [];
      for (const batch of chunk(postIds, BATCH_GET_CHUNK_SIZE)) {
        const result = await client.send(
          new BatchGetCommand({
            RequestItems: {
              [tableName]: { Keys: batch.map((postId) => ({ postId })) },
            },
          }),
        );
        posts.push(...((result.Responses?.[tableName] ?? []) as PostRecord[]));
      }
      return posts;
    },

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

      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { postId },
          UpdateExpression: `SET ${names.map((name) => `#${name} = :${name}`).join(', ')}`,
          ExpressionAttributeNames: Object.fromEntries(names.map((name) => [`#${name}`, name])),
          ExpressionAttributeValues: Object.fromEntries(
            names.map((name) => [`:${name}`, assigned[name]]),
          ),
        }),
      );
    },
  };
}
