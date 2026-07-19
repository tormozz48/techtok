import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { createUsersRepo } from './usersRepo';

const ddbMock = mockClient(DynamoDBDocumentClient);
const client = ddbMock as unknown as DynamoDBDocumentClient;

beforeEach(() => {
  ddbMock.reset();
});

describe('usersRepo.touch', () => {
  it('upserts createdAt/topics only if absent and always bumps lastSeenAt', async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { userId: 'device-1', topics: [], createdAt: 'x', lastSeenAt: 'y' },
    });
    const repo = createUsersRepo(client, 'Users');

    const user = await repo.touch('device-1');

    expect(user.userId).toBe('device-1');
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ userId: 'device-1' });
    expect(input?.UpdateExpression).toContain('if_not_exists(createdAt, :now)');
    expect(input?.UpdateExpression).toContain('lastSeenAt = :now');
    expect(input?.UpdateExpression).toContain('if_not_exists(topics, :emptyTopics)');
  });
});

describe('usersRepo.updateTopics', () => {
  it('sets the topics list and bumps lastSeenAt', async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { userId: 'device-1', topics: ['ai', 'dev'], createdAt: 'x', lastSeenAt: 'y' },
    });
    const repo = createUsersRepo(client, 'Users');

    const user = await repo.updateTopics('device-1', ['ai', 'dev']);

    expect(user.topics).toEqual(['ai', 'dev']);
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':topics': ['ai', 'dev'] });
  });
});
