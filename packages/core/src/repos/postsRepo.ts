import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  type DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Topic } from '@techtok/shared';
import type { NewPost, PostRecord, PostStatus, TransformKind } from '../posts/types';

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

    async updateTransform(postId: string, fields: TransformUpdateFields): Promise<void> {
      // #status/#transform: both are reserved words in DynamoDB's expression
      // grammar and fail with a validation error if used unaliased.
      const setParts = ['#status = :status', '#transform = :transform'];
      const names: Record<string, string> = { '#status': 'status', '#transform': 'transform' };
      const values: Record<string, unknown> = {
        ':status': fields.status,
        ':transform': fields.transform,
      };
      if (fields.summary !== undefined) {
        setParts.push('summary = :summary');
        values[':summary'] = fields.summary;
      }
      if (fields.excerpt !== undefined) {
        setParts.push('excerpt = :excerpt');
        values[':excerpt'] = fields.excerpt;
      }
      if (fields.s3RawKey !== undefined) {
        setParts.push('s3RawKey = :s3RawKey');
        values[':s3RawKey'] = fields.s3RawKey;
      }
      if (fields.cardTitle !== undefined) {
        setParts.push('cardTitle = :cardTitle');
        values[':cardTitle'] = fields.cardTitle;
      }
      if (fields.whyItMatters !== undefined) {
        setParts.push('whyItMatters = :whyItMatters');
        values[':whyItMatters'] = fields.whyItMatters;
      }
      if (fields.primaryTopic !== undefined) {
        setParts.push('primaryTopic = :primaryTopic');
        values[':primaryTopic'] = fields.primaryTopic;
      }
      if (fields.topics !== undefined) {
        // #topics: not a proven-safe unaliased name like `primaryTopic` (used
        // unaliased elsewhere in this file) — aliased out of caution given
        // the status/transform reserved-word incident already hit once here.
        setParts.push('#topics = :topics');
        names['#topics'] = 'topics';
        values[':topics'] = fields.topics;
      }
      if (fields.lang !== undefined) {
        setParts.push('lang = :lang');
        values[':lang'] = fields.lang;
      }
      if (fields.mirroredImageUrl !== undefined) {
        setParts.push('mirroredImageUrl = :mirroredImageUrl');
        values[':mirroredImageUrl'] = fields.mirroredImageUrl;
      }

      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { postId },
          UpdateExpression: `SET ${setParts.join(', ')}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        }),
      );
    },
  };
}
