import {
  BatchWriteCommand,
  DeleteCommand,
  type DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { batchGetChunked } from '../clients/dynamoClient';
import type { ActivityRecord, BookmarkRecord, ReadSnapshot } from '../history.types';
import { chunk } from '../util/chunk';

const BATCH_GET_CHUNK_SIZE = 100;
/** DynamoDB's BatchWriteItem hard cap. */
const BATCH_WRITE_CHUNK_SIZE = 25;

export interface HistoryPage {
  readonly items: ActivityRecord[];
  readonly nextCursor: string | null;
}

export interface BookmarksPage {
  readonly items: BookmarkRecord[];
  readonly nextCursor: string | null;
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

export class UserActivityRepo {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /** `wasNew` is true only when no read-marker existed for this postId
   * before this call — POST /v1/reads is documented idempotent (a retried
   * or re-sent postId just overwrites readAt/snapshot), but the topic-read
   * affinity counter it drives (usersRepo.addTopicReads) is not, so the
   * handler uses this to count each post's first read exactly once. */
  async markRead(
    userId: string,
    postId: string,
    snapshot: ReadSnapshot,
    readAt: string = new Date().toISOString(),
  ): Promise<{ wasNew: boolean }> {
    const record: ActivityRecord = {
      userId,
      sk: readSortKey(postId),
      postId,
      readAt,
      snapshot,
      gsi1sk: `${readAt}#${postId}`,
    };
    const result = await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: record, ReturnValues: 'ALL_OLD' }),
    );
    return { wasNew: result.Attributes === undefined };
  }

  async getReadSet(userId: string, postIds: string[]): Promise<Set<string>> {
    return this.batchGetMarkedIds(userId, postIds, readSortKey);
  }

  async queryHistory(
    userId: string,
    opts: { limit?: number; cursor?: string } = {},
  ): Promise<HistoryPage> {
    return this.queryNewestFirstPage<ActivityRecord>('byReadAt', userId, opts);
  }

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
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: record }));
  }

  async removeBookmark(userId: string, postId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { userId, sk: bookmarkSortKey(postId) },
      }),
    );
  }

  async getBookmarkSet(userId: string, postIds: string[]): Promise<Set<string>> {
    return this.batchGetMarkedIds(userId, postIds, bookmarkSortKey);
  }

  async queryBookmarks(
    userId: string,
    opts: { limit?: number; cursor?: string } = {},
  ): Promise<BookmarksPage> {
    return this.queryNewestFirstPage<BookmarkRecord>('byBookmarkedAt', userId, opts);
  }

  /** Deletes every row (reads and bookmarks alike — both live in this same
   * base-table partition, `read#`/`bm#` sort-key prefixes) for a user. Used
   * only by `DELETE /v1/me` (D68), a Play policy requirement — paginates the
   * full partition via the base table's key (no GSI needed, since `userId`
   * is already the partition key) and issues chunked `BatchWriteItem`
   * deletes, 25 at a time. */
  async deleteAllForUser(userId: string): Promise<void> {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
          ProjectionExpression: 'userId, sk',
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      const keys = (page.Items ?? []) as { userId: string; sk: string }[];
      for (const batch of chunk(keys, BATCH_WRITE_CHUNK_SIZE)) {
        if (batch.length === 0) continue;
        await this.client.send(
          new BatchWriteCommand({
            RequestItems: {
              [this.tableName]: batch.map((key) => ({ DeleteRequest: { Key: key } })),
            },
          }),
        );
      }
      exclusiveStartKey = page.LastEvaluatedKey;
    } while (exclusiveStartKey);
  }

  private async batchGetMarkedIds(
    userId: string,
    postIds: string[],
    sortKey: (postId: string) => string,
  ): Promise<Set<string>> {
    const items = await batchGetChunked<string, ActivityRecord | BookmarkRecord>(
      this.client,
      this.tableName,
      postIds,
      (postId) => ({ userId, sk: sortKey(postId) }),
      BATCH_GET_CHUNK_SIZE,
    );
    return new Set(items.map((item) => item.postId));
  }

  private async queryNewestFirstPage<T>(
    indexName: string,
    userId: string,
    opts: { limit?: number; cursor?: string },
  ): Promise<{ items: T[]; nextCursor: string | null }> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: indexName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ScanIndexForward: false,
        Limit: opts.limit ?? 50,
        ExclusiveStartKey: opts.cursor ? decodeHistoryCursor(opts.cursor) : undefined,
      }),
    );

    return {
      items: (result.Items ?? []) as T[],
      nextCursor: result.LastEvaluatedKey ? encodeHistoryCursor(result.LastEvaluatedKey) : null,
    };
  }
}
