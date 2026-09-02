import { getTopicLabel, TOPICS, topicsQuerySchema, topicsResponseSchema } from '@techtok/shared';
import { jsonResponse, parseQuery, withPublic } from '../lib/http';

export const handler = withPublic(async (event) => {
  const query = parseQuery(event, topicsQuerySchema);
  if (!query.ok) return query.response;

  const body = topicsResponseSchema.parse({
    topics: TOPICS.map((id) => ({ id, label: getTopicLabel(id, query.data.lang) })),
  });
  return jsonResponse(200, body);
});
