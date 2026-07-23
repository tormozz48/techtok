import { getTopicLabel, TOPICS, topicsQuerySchema, topicsResponseSchema } from '@techtok/shared';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { jsonResponse, parseQuery } from './http';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const query = parseQuery(event, topicsQuerySchema);
  if (!query.ok) return query.response;

  const body = topicsResponseSchema.parse({
    topics: TOPICS.map((id) => ({ id, label: getTopicLabel(id, query.data.lang) })),
  });
  return jsonResponse(200, body);
};
