import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { ContentJobsRepo } from './contentJobsRepo';

const ddbMock = mockClient(DynamoDBDocumentClient);
const client = ddbMock as unknown as DynamoDBDocumentClient;

beforeEach(() => {
  ddbMock.reset();
});

describe('contentJobsRepo.create', () => {
  it('writes a new job at the fetching stage with available null', async () => {
    ddbMock.on(PutCommand).resolves({});
    const repo = new ContentJobsRepo(client, 'ContentJobs');

    await repo.create('job1', 'post1', 'ru');

    const input = ddbMock.commandCalls(PutCommand)[0]?.args[0]?.input;
    expect(input?.Item?.jobId).toBe('job1');
    expect(input?.Item?.postId).toBe('post1');
    expect(input?.Item?.lang).toBe('ru');
    expect(input?.Item?.stage).toBe('fetching');
    expect(input?.Item?.available).toBeNull();
    expect(typeof input?.Item?.ttl).toBe('number');
  });
});

describe('contentJobsRepo.getById', () => {
  it('returns the item when found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { jobId: 'job1', stage: 'extracting' } });
    const repo = new ContentJobsRepo(client, 'ContentJobs');

    const job = await repo.getById('job1');

    expect(job).toEqual({ jobId: 'job1', stage: 'extracting' });
  });

  it('returns undefined when not found', async () => {
    ddbMock.on(GetCommand).resolves({});
    const repo = new ContentJobsRepo(client, 'ContentJobs');

    expect(await repo.getById('missing')).toBeUndefined();
  });
});

describe('contentJobsRepo.updateStage', () => {
  it('sets the aliased stage attribute', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new ContentJobsRepo(client, 'ContentJobs');

    await repo.updateStage('job1', 'translating');

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ jobId: 'job1' });
    expect(input?.UpdateExpression).toBe('SET #stage = :stage');
    expect(input?.ExpressionAttributeNames).toEqual({ '#stage': 'stage' });
    expect(input?.ExpressionAttributeValues).toEqual({ ':stage': 'translating' });
  });
});

describe('contentJobsRepo.complete', () => {
  it('writes done+available+blocks+figures on success', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new ContentJobsRepo(client, 'ContentJobs');
    const blocks = [{ type: 'paragraph' as const, text: 'hi' }];
    const figures = [{ url: 'https://cdn.example.com/fig.jpg' }];

    await repo.complete('job1', { available: true, blocks, figures });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ jobId: 'job1' });
    expect(input?.ExpressionAttributeValues).toEqual({
      ':stage': 'done',
      ':available': true,
      ':blocks': blocks,
      ':figures': figures,
    });
  });

  it('writes done+unavailable+reason on failure', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new ContentJobsRepo(client, 'ContentJobs');

    await repo.complete('job1', { available: false, reason: 'llm failed' });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ jobId: 'job1' });
    expect(input?.ExpressionAttributeValues).toEqual({
      ':stage': 'done',
      ':available': false,
      ':reason': 'llm failed',
    });
  });
});
