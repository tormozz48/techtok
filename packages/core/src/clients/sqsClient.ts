import { SQSClient } from '@aws-sdk/client-sqs';

export function createSqsClient(): SQSClient {
  return new SQSClient({});
}
