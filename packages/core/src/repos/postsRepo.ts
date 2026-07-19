import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  type DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Topic } from '@techtok/shared';
import type { NewPost, PostRecord } from '../posts/types';

const POST_TTL_SECONDS = 90 * 24 * 60 * 60;
const BY_TIME_PARTITION = 'POST';
const BATCH_GET_CHUNK_SIZE = 100;

export interface QueryOpts {
  before?: string;
  limit?: number;
}

export interface PostsRepo {
  putIfNew(post: NewPost): Promise<boolean>;
  queryByTopic(topic: Topic, opts?: QueryOpts): Promise<PostRecord[]>;
  queryRecent(opts?: QueryOpts): Promise<PostRecord[]>;
  getByIds(postIds: string[]): Promise<PostRecord[]>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function createPostsRepo(client: DynamoDBDocumentClient, tableName: string): PostsRepo {
  return {
    async putIfNew(post: NewPost): Promise<boolean> {
      const now = new Date();
      const record: PostRecord & { gsi1pk: string } = {
        ...post,
        ingestedAt: now.toISOString(),
        ttl: Math.floor(now.getTime() / 1000) + POST_TTL_SECONDS,
        gsi1pk: BY_TIME_PARTITION,
      };

      try {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: record,
            ConditionExpression: 'attribute_not_exists(postId)',
          }),
        );
        return true;
      } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
          return false;
        }
        throw err;
      }
    },

    async queryByTopic(topic: Topic, opts: QueryOpts = {}): Promise<PostRecord[]> {
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'byTopic',
          KeyConditionExpression: opts.before
            ? 'primaryTopic = :topic AND publishedAt < :before'
            : 'primaryTopic = :topic',
          ExpressionAttributeValues: opts.before
            ? { ':topic': topic, ':before': opts.before }
            : { ':topic': topic },
          ScanIndexForward: false,
          Limit: opts.limit ?? 20,
        }),
      );
      return (result.Items ?? []) as PostRecord[];
    },

    async queryRecent(opts: QueryOpts = {}): Promise<PostRecord[]> {
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'byTime',
          KeyConditionExpression: opts.before
            ? 'gsi1pk = :pk AND publishedAt < :before'
            : 'gsi1pk = :pk',
          ExpressionAttributeValues: opts.before
            ? { ':pk': BY_TIME_PARTITION, ':before': opts.before }
            : { ':pk': BY_TIME_PARTITION },
          ScanIndexForward: false,
          Limit: opts.limit ?? 20,
        }),
      );
      return (result.Items ?? []) as PostRecord[];
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
  };
}
