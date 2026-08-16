import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserActivityRepo } from './userActivityRepo';

const ddbMock = mockClient(DynamoDBDocumentClient);
const client = ddbMock as unknown as DynamoDBDocumentClient;

beforeEach(() => {
  ddbMock.reset();
});

const snapshot = { cardTitle: 'Title', sourceName: 'Hacker News', url: 'https://example.com/a' };

describe('userActivityRepo.markRead', () => {
  it('writes a read-marker item keyed by userId and read#<postId>', async () => {
    ddbMock.on(PutCommand).resolves({});
    const repo = new UserActivityRepo(client, 'UserActivity');

    await repo.markRead('device-1', 'abc123', snapshot, '2026-07-18T00:00:00.000Z');

    const input = ddbMock.commandCalls(PutCommand)[0]?.args[0]?.input;
    expect(input?.Item).toMatchObject({
      userId: 'device-1',
      sk: 'read#abc123',
      postId: 'abc123',
      readAt: '2026-07-18T00:00:00.000Z',
      snapshot,
      gsi1sk: '2026-07-18T00:00:00.000Z#abc123',
    });
    expect(input?.ReturnValues).toBe('ALL_OLD');
  });

  it('reports wasNew: true when no prior read-marker existed', async () => {
    ddbMock.on(PutCommand).resolves({});
    const repo = new UserActivityRepo(client, 'UserActivity');

    const result = await repo.markRead('device-1', 'abc123', snapshot);

    expect(result).toEqual({ wasNew: true });
  });

  it('reports wasNew: false when a read-marker already existed (retry/re-read)', async () => {
    ddbMock.on(PutCommand).resolves({
      Attributes: { userId: 'device-1', sk: 'read#abc123', postId: 'abc123', ...snapshot },
    });
    const repo = new UserActivityRepo(client, 'UserActivity');

    const result = await repo.markRead('device-1', 'abc123', snapshot);

    expect(result).toEqual({ wasNew: false });
  });
});

describe('userActivityRepo.getReadSet', () => {
  it('returns an empty set without calling DynamoDB when given no ids', async () => {
    const repo = new UserActivityRepo(client, 'UserActivity');

    expect(await repo.getReadSet('device-1', [])).toEqual(new Set());
    expect(ddbMock.commandCalls(BatchGetCommand)).toHaveLength(0);
  });

  it('batch-gets read markers and returns the set of read postIds', async () => {
    ddbMock.on(BatchGetCommand).resolves({
      Responses: {
        UserActivity: [{ userId: 'device-1', sk: 'read#abc123', postId: 'abc123', ...snapshot }],
      },
    });
    const repo = new UserActivityRepo(client, 'UserActivity');

    const readIds = await repo.getReadSet('device-1', ['abc123', 'def456']);

    expect(readIds).toEqual(new Set(['abc123']));
    const input = ddbMock.commandCalls(BatchGetCommand)[0]?.args[0]?.input;
    expect(input?.RequestItems?.UserActivity?.Keys).toEqual([
      { userId: 'device-1', sk: 'read#abc123' },
      { userId: 'device-1', sk: 'read#def456' },
    ]);
  });
});

describe('userActivityRepo.queryHistory', () => {
  it('queries the byReadAt GSI newest-first and returns a null cursor when exhausted', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const repo = new UserActivityRepo(client, 'UserActivity');

    const page = await repo.queryHistory('device-1', { limit: 10 });

    expect(page).toEqual({ items: [], nextCursor: null });
    const input = ddbMock.commandCalls(QueryCommand)[0]?.args[0]?.input;
    expect(input?.IndexName).toBe('byReadAt');
    expect(input?.ScanIndexForward).toBe(false);
    expect(input?.Limit).toBe(10);
  });

  it('decodes the cursor into ExclusiveStartKey and encodes LastEvaluatedKey back', async () => {
    const lastKey = { userId: 'device-1', sk: 'read#abc123', gsi1sk: 'x#abc123' };
    ddbMock.on(QueryCommand).resolves({ Items: [], LastEvaluatedKey: lastKey });
    const repo = new UserActivityRepo(client, 'UserActivity');
    const priorKey = { userId: 'device-1', sk: 'read#prev', gsi1sk: 'y#prev' };
    const cursor = Buffer.from(JSON.stringify(priorKey), 'utf8').toString('base64url');

    const page = await repo.queryHistory('device-1', { cursor });

    const input = ddbMock.commandCalls(QueryCommand)[0]?.args[0]?.input;
    expect(input?.ExclusiveStartKey).toEqual(priorKey);
    expect(page.nextCursor).toBe(
      Buffer.from(JSON.stringify(lastKey), 'utf8').toString('base64url'),
    );
  });
});

describe('userActivityRepo.addBookmark', () => {
  it('writes a bookmark item keyed by userId and bm#<postId>', async () => {
    ddbMock.on(PutCommand).resolves({});
    const repo = new UserActivityRepo(client, 'UserActivity');

    await repo.addBookmark('device-1', 'abc123', snapshot, '2026-07-18T00:00:00.000Z');

    const input = ddbMock.commandCalls(PutCommand)[0]?.args[0]?.input;
    expect(input?.Item).toMatchObject({
      userId: 'device-1',
      sk: 'bm#abc123',
      postId: 'abc123',
      bookmarkedAt: '2026-07-18T00:00:00.000Z',
      snapshot,
      gsi2sk: '2026-07-18T00:00:00.000Z#abc123',
    });
  });
});

describe('userActivityRepo.removeBookmark', () => {
  it('deletes the bm#<postId> item for that user', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const repo = new UserActivityRepo(client, 'UserActivity');

    await repo.removeBookmark('device-1', 'abc123');

    const input = ddbMock.commandCalls(DeleteCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ userId: 'device-1', sk: 'bm#abc123' });
  });
});

describe('userActivityRepo.getBookmarkSet', () => {
  it('returns an empty set without calling DynamoDB when given no ids', async () => {
    const repo = new UserActivityRepo(client, 'UserActivity');

    expect(await repo.getBookmarkSet('device-1', [])).toEqual(new Set());
    expect(ddbMock.commandCalls(BatchGetCommand)).toHaveLength(0);
  });

  it('batch-gets bookmark markers and returns the set of bookmarked postIds', async () => {
    ddbMock.on(BatchGetCommand).resolves({
      Responses: {
        UserActivity: [{ userId: 'device-1', sk: 'bm#abc123', postId: 'abc123', ...snapshot }],
      },
    });
    const repo = new UserActivityRepo(client, 'UserActivity');

    const bookmarked = await repo.getBookmarkSet('device-1', ['abc123', 'def456']);

    expect(bookmarked).toEqual(new Set(['abc123']));
    const input = ddbMock.commandCalls(BatchGetCommand)[0]?.args[0]?.input;
    expect(input?.RequestItems?.UserActivity?.Keys).toEqual([
      { userId: 'device-1', sk: 'bm#abc123' },
      { userId: 'device-1', sk: 'bm#def456' },
    ]);
  });
});

describe('userActivityRepo.queryBookmarks', () => {
  it('queries the byBookmarkedAt GSI newest-first and returns a null cursor when exhausted', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const repo = new UserActivityRepo(client, 'UserActivity');

    const page = await repo.queryBookmarks('device-1', { limit: 10 });

    expect(page).toEqual({ items: [], nextCursor: null });
    const input = ddbMock.commandCalls(QueryCommand)[0]?.args[0]?.input;
    expect(input?.IndexName).toBe('byBookmarkedAt');
    expect(input?.ScanIndexForward).toBe(false);
    expect(input?.Limit).toBe(10);
  });
});

describe('userActivityRepo.deleteAllForUser', () => {
  it('deletes nothing and issues no BatchWrite when the user has no rows', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const repo = new UserActivityRepo(client, 'UserActivity');

    await repo.deleteAllForUser('device-1');

    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(0);
  });

  it('batch-deletes every row for the user, chunked at 25 per BatchWriteItem call', async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      userId: 'device-1',
      sk: `read#post-${i}`,
    }));
    ddbMock.on(QueryCommand).resolves({ Items: items });
    ddbMock.on(BatchWriteCommand).resolves({});
    const repo = new UserActivityRepo(client, 'UserActivity');

    await repo.deleteAllForUser('device-1');

    const calls = ddbMock.commandCalls(BatchWriteCommand);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.args[0]?.input.RequestItems?.UserActivity).toHaveLength(25);
    expect(calls[1]?.args[0]?.input.RequestItems?.UserActivity).toHaveLength(5);
    expect(calls[0]?.args[0]?.input.RequestItems?.UserActivity?.[0]).toEqual({
      DeleteRequest: { Key: { userId: 'device-1', sk: 'read#post-0' } },
    });
  });

  it('follows LastEvaluatedKey across multiple Query pages', async () => {
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({
        Items: [{ userId: 'device-1', sk: 'read#post-1' }],
        LastEvaluatedKey: { userId: 'device-1', sk: 'read#post-1' },
      })
      .resolvesOnce({ Items: [{ userId: 'device-1', sk: 'read#post-2' }] });
    ddbMock.on(BatchWriteCommand).resolves({});
    const repo = new UserActivityRepo(client, 'UserActivity');

    await repo.deleteAllForUser('device-1');

    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(2);
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(2);
    const secondQueryInput = ddbMock.commandCalls(QueryCommand)[1]?.args[0]?.input;
    expect(secondQueryInput?.ExclusiveStartKey).toEqual({ userId: 'device-1', sk: 'read#post-1' });
  });
});
