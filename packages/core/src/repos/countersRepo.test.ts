import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { CountersRepo } from './countersRepo';

const ddbMock = mockClient(DynamoDBDocumentClient);
const client = ddbMock as unknown as DynamoDBDocumentClient;

beforeEach(() => {
  ddbMock.reset();
});

describe('countersRepo.incrementIfUnderCap', () => {
  it('increments the given counter and returns true when under cap', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new CountersRepo(client, 'Counters');

    const underCap = await repo.incrementIfUnderCap('transforms#2026-07-19', 120);

    expect(underCap).toBe(true);
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ counterId: 'transforms#2026-07-19' });
    expect(input?.UpdateExpression).toBe('ADD #count :one');
    expect(input?.ConditionExpression).toBe('attribute_not_exists(#count) OR #count < :cap');
    expect(input?.ExpressionAttributeNames).toEqual({ '#count': 'count' });
    expect(input?.ExpressionAttributeValues).toEqual({ ':one': 1, ':cap': 120 });
  });

  it('accepts any counterId prefix (translations, per-source quotas, ...)', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new CountersRepo(client, 'Counters');

    await repo.incrementIfUnderCap('translations#2026-07-19', 100);
    await repo.incrementIfUnderCap('transforms#huggingface-blog#2026-07-19', 10);

    const calls = ddbMock.commandCalls(UpdateCommand);
    expect(calls[0]?.args[0]?.input?.Key).toEqual({ counterId: 'translations#2026-07-19' });
    expect(calls[1]?.args[0]?.input?.Key).toEqual({
      counterId: 'transforms#huggingface-blog#2026-07-19',
    });
  });

  it('returns false without throwing once the cap is reached', async () => {
    ddbMock.on(UpdateCommand).rejects(
      new ConditionalCheckFailedException({
        message: 'The conditional request failed',
        $metadata: {},
      }),
    );
    const repo = new CountersRepo(client, 'Counters');

    await expect(repo.incrementIfUnderCap('transforms#2026-07-19', 5)).resolves.toBe(false);
  });

  it('rethrows errors that are not a conditional check failure', async () => {
    ddbMock.on(UpdateCommand).rejects(new Error('ddb down'));
    const repo = new CountersRepo(client, 'Counters');

    await expect(repo.incrementIfUnderCap('transforms#2026-07-19', 120)).rejects.toThrow(
      'ddb down',
    );
  });
});
