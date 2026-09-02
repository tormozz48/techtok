import { historyQuerySchema, historyResponseSchema } from '@techtok/shared';
import { getUserActivityRepo } from '../../repos';
import { jsonResponse, parseQuery, withAuth } from '../lib/http';
import { toHistoryItem } from '../transformers/toHistoryItem';

export const handler = withAuth(async (event, auth) => {
  const query = parseQuery(event, historyQuerySchema);
  if (!query.ok) return query.response;

  const page = await getUserActivityRepo().queryHistory(auth.userId, query.data);

  const body = historyResponseSchema.parse({
    items: page.items.map(toHistoryItem),
    nextCursor: page.nextCursor,
  });

  return jsonResponse(200, body);
});
