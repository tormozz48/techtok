import { DescribeExecutionCommand, SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { GetQueueAttributesCommand, SQSClient } from '@aws-sdk/client-sqs';
import { createDynamoClient, SourcesRepo } from '@techtok/core';
import { describe, expect, it } from 'vitest';
import { discoverDevResources, REGION } from './awsDiscovery';

const EXECUTION_TIMEOUT_MS = 5 * 60_000;
const QUEUE_DRAIN_TIMEOUT_MS = 3 * 60_000;
const POLL_INTERVAL_MS = 10_000;
const TEST_TIMEOUT_MS = EXECUTION_TIMEOUT_MS + 2 * QUEUE_DRAIN_TIMEOUT_MS + 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForExecution(client: SFNClient, executionArn: string): Promise<string> {
  const deadline = Date.now() + EXECUTION_TIMEOUT_MS;
  for (;;) {
    const { status } = await client.send(new DescribeExecutionCommand({ executionArn }));
    if (status && status !== 'RUNNING') return status;
    if (Date.now() >= deadline) {
      throw new Error(
        `IngestPipeline execution ${executionArn} did not finish within ${EXECUTION_TIMEOUT_MS}ms`,
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

async function waitForQueueDrain(
  client: SQSClient,
  queueUrl: string,
  label: string,
): Promise<void> {
  const deadline = Date.now() + QUEUE_DRAIN_TIMEOUT_MS;
  for (;;) {
    const { Attributes } = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
      }),
    );
    const visible = Number(Attributes?.ApproximateNumberOfMessages ?? '0');
    const inFlight = Number(Attributes?.ApproximateNumberOfMessagesNotVisible ?? '0');
    if (visible === 0 && inFlight === 0) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `${label} did not drain within ${QUEUE_DRAIN_TIMEOUT_MS}ms (visible=${visible}, inFlight=${inFlight})`,
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Triggers a real `IngestPipeline` execution against the deployed `dev`
 * stage and asserts the real DynamoDB/SQS state transitions it should cause:
 * the execution itself succeeds, every source's `Sources` row picks up a
 * fresh `lastFetchAt`, and the queues the run feeds (Transform → Translate)
 * fully drain afterward. Never run against `production` (DESIGN §2 D34).
 */
describe('backend pipeline E2E', () => {
  it(
    'runs a real IngestPipeline execution and drains the Transform/Translate queues',
    async () => {
      const resources = await discoverDevResources();
      const sfn = new SFNClient({ region: REGION });
      const sqs = new SQSClient({ region: REGION });
      const dynamo = createDynamoClient();
      const sourcesRepo = new SourcesRepo(dynamo, resources.sourcesTableName);

      const beforeSources = await sourcesRepo.listEnabled();
      const startedAt = Date.now();

      const { executionArn } = await sfn.send(
        new StartExecutionCommand({ stateMachineArn: resources.ingestPipelineArn }),
      );
      expect(executionArn).toBeTruthy();
      if (!executionArn) throw new Error('StartExecution did not return an executionArn');

      const status = await waitForExecution(sfn, executionArn);
      expect(status).toBe('SUCCEEDED');

      const afterSources = await sourcesRepo.listEnabled();
      const staleSources = afterSources.filter((source) => {
        const before = beforeSources.find((b) => b.sourceId === source.sourceId);
        const lastFetchAt = source.lastFetchAt ? Date.parse(source.lastFetchAt) : undefined;
        return (
          !lastFetchAt || lastFetchAt < startedAt || before?.lastFetchAt === source.lastFetchAt
        );
      });
      expect(staleSources).toEqual([]);

      await waitForQueueDrain(sqs, resources.transformQueueUrl, 'TransformQueue');
      await waitForQueueDrain(sqs, resources.translateQueueUrl, 'TranslateQueue');
    },
    TEST_TIMEOUT_MS,
  );
});
