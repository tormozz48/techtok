import { searchActivity } from '@techtok/core';
import { historyQuerySchema, historyResponseSchema } from '@techtok/shared';
import { getUserActivityRepo } from '../../repos';
import { jsonResponse, parseQuery, withAuth } from '../lib/http';
import { toHistoryItem } from '../transformers/toHistoryItem';

const SEARCH_PAGE_SIZE = 100;

export const handler = withAuth(async (event, auth) => {
  const query = parseQuery(event, historyQuerySchema);
  if (!query.ok) return query.response;

  const activity = getUserActivityRepo();
  const page = query.data.q
    ? await searchActivity(
        (cursor) => activity.queryHistory(auth.userId, { limit: SEARCH_PAGE_SIZE, cursor }),
        { q: query.data.q, limit: query.data.limit },
      )
    : await activity.queryHistory(auth.userId, query.data);

  const body = historyResponseSchema.parse({
    items: page.items.map(toHistoryItem),
    nextCursor: page.nextCursor,
  });

  return jsonResponse(200, body);
});
