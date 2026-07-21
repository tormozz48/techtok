import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SourceRecord } from '../sources.types';
import { SourcesRepo } from './sourcesRepo';

const ddbMock = mockClient(DynamoDBDocumentClient);
const client = ddbMock as unknown as DynamoDBDocumentClient;

beforeEach(() => {
  ddbMock.reset();
});

const sampleSource: SourceRecord = {
  sourceId: 'hn',
  name: 'Hacker News',
  rssUrl: 'https://hnrss.org/frontpage',
  defaultTopic: 'dev',
  topics: ['dev'],
  weight: 1,
  enabled: true,
  failCount: 0,
};

describe('sourcesRepo.listEnabled', () => {
  it('scans with an enabled filter', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [sampleSource] });
    const repo = new SourcesRepo(client, 'Sources');

    const items = await repo.listEnabled();

    expect(items).toEqual([sampleSource]);
    const input = ddbMock.commandCalls(ScanCommand)[0]?.args[0]?.input;
    expect(input?.FilterExpression).toBe('enabled = :true');
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':true': true });
  });
});

describe('sourcesRepo.putIfNew', () => {
  it('writes a conditional put', async () => {
    ddbMock.on(PutCommand).resolves({});
    const repo = new SourcesRepo(client, 'Sources');

    const created = await repo.putIfNew(sampleSource);

    expect(created).toBe(true);
    const input = ddbMock.commandCalls(PutCommand)[0]?.args[0]?.input;
    expect(input?.ConditionExpression).toBe('attribute_not_exists(sourceId)');
  });

  it('returns false without throwing when the source already exists', async () => {
    ddbMock.on(PutCommand).rejects(
      new ConditionalCheckFailedException({
        message: 'The conditional request failed',
        $metadata: {},
      }),
    );
    const repo = new SourcesRepo(client, 'Sources');

    await expect(repo.putIfNew(sampleSource)).resolves.toBe(false);
  });
});

describe('sourcesRepo.recordFetchResult', () => {
  it('resets failCount and stores etag/lastModified on success', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new SourcesRepo(client, 'Sources');

    await repo.recordFetchResult('hn', {
      status: 'ok',
      etag: 'W/"abc"',
      lastModified: 'Sat, 18 Jul 2026 00:00:00 GMT',
    });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.UpdateExpression).toContain('failCount = :zero');
    expect(input?.UpdateExpression).toContain('etag = :etag');
    expect(input?.UpdateExpression).toContain('lastModified = :lastModified');
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':status': 'ok',
      ':zero': 0,
      ':etag': 'W/"abc"',
      ':lastModified': 'Sat, 18 Jul 2026 00:00:00 GMT',
    });
  });

  it('records not-modified without requiring etag/lastModified', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new SourcesRepo(client, 'Sources');

    await repo.recordFetchResult('hn', { status: 'not-modified' });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.UpdateExpression).not.toContain('etag');
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':status': 'not-modified' });
  });

  it('increments failCount on error and leaves etag/lastModified untouched', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new SourcesRepo(client, 'Sources');

    await repo.recordFetchResult('hn', { status: 'error' });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.UpdateExpression).toBe(
      'SET lastFetchAt = :now, lastStatus = :status ADD failCount :one',
    );
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':status': 'error', ':one': 1 });
  });
});
