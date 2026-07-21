import { TOPIC_LABELS, TOPICS, topicsResponseSchema } from '@techtok/shared';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { jsonResponse } from './http';

export const handler: APIGatewayProxyHandlerV2 = async () => {
  const body = topicsResponseSchema.parse({
    topics: TOPICS.map((id) => ({ id, label: TOPIC_LABELS[id] })),
  });
  return jsonResponse(200, body);
};
