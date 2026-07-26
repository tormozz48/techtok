import { searchActivity } from '@techtok/core';
import { bookmarksQuerySchema, bookmarksResponseSchema } from '@techtok/shared';
import { getUserActivityRepo } from '../../repos';
import { jsonResponse, parseQuery, withDeviceId } from '../lib/http';
import { toBookmarkItem } from '../transformers/toBookmarkItem';

const SEARCH_PAGE_SIZE = 100;

export const handler = withDeviceId(async (event, deviceId) => {
  const query = parseQuery(event, bookmarksQuerySchema);
  if (!query.ok) return query.response;

  const activity = getUserActivityRepo();
  const page = query.data.q
    ? await searchActivity(
        (cursor) => activity.queryBookmarks(deviceId, { limit: SEARCH_PAGE_SIZE, cursor }),
        { q: query.data.q, limit: query.data.limit },
      )
    : await activity.queryBookmarks(deviceId, query.data);

  const body = bookmarksResponseSchema.parse({
    items: page.items.map(toBookmarkItem),
    nextCursor: page.nextCursor,
  });

  return jsonResponse(200, body);
});
