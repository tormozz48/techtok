import {
  BatchGetCommand,
  DeleteCommand,
  type DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { ActivityRecord, BookmarkRecord, ReadSnapshot } from '../history/types';

const BATCH_GET_CHUNK_SIZE = 100;

export interface HistoryPage {
  items: ActivityRecord[];
  nextCursor: string | null;
}

export interface BookmarksPage {
  items: BookmarkRecord[];
  nextCursor: string | null;
}

export interface UserActivityRepo {
  markRead(userId: string, postId: string, snapshot: ReadSnapshot, readAt?: string): Promise<void>;
  getReadSet(userId: string, postIds: string[]): Promise<Set<string>>;
  queryHistory(userId: string, opts?: { limit?: number; cursor?: string }): Promise<HistoryPage>;
  addBookmark(
    userId: string,
    postId: string,
    snapshot: ReadSnapshot,
    bookmarkedAt?: string,
  ): Promise<void>;
  removeBookmark(userId: string, postId: string): Promise<void>;
  getBookmarkSet(userId: string, postIds: string[]): Promise<Set<string>>;
  queryBookmarks(
    userId: string,
    opts?: { limit?: number; cursor?: string },
  ): Promise<BookmarksPage>;
}

export function encodeHistoryCursor(key: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');
}

export function decodeHistoryCursor(cursor: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
}

function readSortKey(postId: string): string {
  return `read#${postId}`;
}

function bookmarkSortKey(postId: string): string {
  return `bm#${postId}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function batchGetMarkedIds(
  client: DynamoDBDocumentClient,
  tableName: string,
  userId: string,
  postIds: string[],
  sortKey: (postId: string) => string,
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();

  const markedIds = new Set<string>();
  for (const batch of chunk(postIds, BATCH_GET_CHUNK_SIZE)) {
    const result = await client.send(
      new BatchGetCommand({
        RequestItems: {
          [tableName]: {
            Keys: batch.map((postId) => ({ userId, sk: sortKey(postId) })),
          },
        },
      }),
    );
    for (const item of result.Responses?.[tableName] ?? []) {
      markedIds.add((item as ActivityRecord | BookmarkRecord).postId);
    }
  }
  return markedIds;
}

export function createUserActivityRepo(
  client: DynamoDBDocumentClient,
  tableName: string,
): UserActivityRepo {
  return {
    async markRead(
      userId: string,
      postId: string,
      snapshot: ReadSnapshot,
      readAt: string = new Date().toISOString(),
    ): Promise<void> {
      const record: ActivityRecord = {
        userId,
        sk: readSortKey(postId),
        postId,
        readAt,
        snapshot,
        gsi1sk: `${readAt}#${postId}`,
      };
      await client.send(new PutCommand({ TableName: tableName, Item: record }));
    },

    async getReadSet(userId: string, postIds: string[]): Promise<Set<string>> {
      return batchGetMarkedIds(client, tableName, userId, postIds, readSortKey);
    },

    async queryHistory(
      userId: string,
      opts: { limit?: number; cursor?: string } = {},
    ): Promise<HistoryPage> {
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'byReadAt',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
          ScanIndexForward: false,
          Limit: opts.limit ?? 50,
          ExclusiveStartKey: opts.cursor ? decodeHistoryCursor(opts.cursor) : undefined,
        }),
      );

      return {
        items: (result.Items ?? []) as ActivityRecord[],
        nextCursor: result.LastEvaluatedKey ? encodeHistoryCursor(result.LastEvaluatedKey) : null,
      };
    },

    async addBookmark(
      userId: string,
      postId: string,
      snapshot: ReadSnapshot,
      bookmarkedAt: string = new Date().toISOString(),
    ): Promise<void> {
      const record: BookmarkRecord = {
        userId,
        sk: bookmarkSortKey(postId),
        postId,
        bookmarkedAt,
        snapshot,
        gsi2sk: `${bookmarkedAt}#${postId}`,
      };
      await client.send(new PutCommand({ TableName: tableName, Item: record }));
    },

    async removeBookmark(userId: string, postId: string): Promise<void> {
      await client.send(
        new DeleteCommand({ TableName: tableName, Key: { userId, sk: bookmarkSortKey(postId) } }),
      );
    },

    async getBookmarkSet(userId: string, postIds: string[]): Promise<Set<string>> {
      return batchGetMarkedIds(client, tableName, userId, postIds, bookmarkSortKey);
    },

    async queryBookmarks(
      userId: string,
      opts: { limit?: number; cursor?: string } = {},
    ): Promise<BookmarksPage> {
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'byBookmarkedAt',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
          ScanIndexForward: false,
          Limit: opts.limit ?? 50,
          ExclusiveStartKey: opts.cursor ? decodeHistoryCursor(opts.cursor) : undefined,
        }),
      );

      return {
        items: (result.Items ?? []) as BookmarkRecord[],
        nextCursor: result.LastEvaluatedKey ? encodeHistoryCursor(result.LastEvaluatedKey) : null,
      };
    },
  };
}
