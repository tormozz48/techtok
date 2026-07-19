import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createUserActivityRepo,
  decodeHistoryCursor,
  encodeHistoryCursor,
} from './userActivityRepo';

const ddbMock = mockClient(DynamoDBDocumentClient);
const client = ddbMock as unknown as DynamoDBDocumentClient;

beforeEach(() => {
  ddbMock.reset();
});

const snapshot = { cardTitle: 'Title', sourceName: 'Hacker News', url: 'https://example.com/a' };

describe('userActivityRepo.markRead', () => {
  it('writes a read-marker item keyed by userId and read#<postId>', async () => {
    ddbMock.on(PutCommand).resolves({});
    const repo = createUserActivityRepo(client, 'UserActivity');

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
  });
});

describe('userActivityRepo.getReadSet', () => {
  it('returns an empty set without calling DynamoDB when given no ids', async () => {
    const repo = createUserActivityRepo(client, 'UserActivity');

    expect(await repo.getReadSet('device-1', [])).toEqual(new Set());
    expect(ddbMock.commandCalls(BatchGetCommand)).toHaveLength(0);
  });

  it('batch-gets read markers and returns the set of read postIds', async () => {
    ddbMock.on(BatchGetCommand).resolves({
      Responses: {
        UserActivity: [{ userId: 'device-1', sk: 'read#abc123', postId: 'abc123', ...snapshot }],
      },
    });
    const repo = createUserActivityRepo(client, 'UserActivity');

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
    const repo = createUserActivityRepo(client, 'UserActivity');

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
    const repo = createUserActivityRepo(client, 'UserActivity');
    const cursor = encodeHistoryCursor({ userId: 'device-1', sk: 'read#prev', gsi1sk: 'y#prev' });

    const page = await repo.queryHistory('device-1', { cursor });

    const input = ddbMock.commandCalls(QueryCommand)[0]?.args[0]?.input;
    expect(input?.ExclusiveStartKey).toEqual(decodeHistoryCursor(cursor));
    expect(page.nextCursor).toBe(encodeHistoryCursor(lastKey));
  });
});

describe('history cursor encode/decode', () => {
  it('round-trips a key through base64url', () => {
    const key = { userId: 'device-1', sk: 'read#abc123', gsi1sk: '2026-07-18#abc123' };
    expect(decodeHistoryCursor(encodeHistoryCursor(key))).toEqual(key);
  });
});
