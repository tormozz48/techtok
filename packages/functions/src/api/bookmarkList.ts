import { bookmarksQuerySchema, bookmarksResponseSchema } from '@techtok/shared';
import { getUserActivityRepo } from '../repos';
import { jsonResponse, parseQuery, withDeviceId } from './http';
import { toBookmarkItem } from './toBookmarkItem';

export const handler = withDeviceId(async (event, deviceId) => {
  const query = parseQuery(event, bookmarksQuerySchema);
  if (!query.ok) return query.response;

  const page = await getUserActivityRepo().queryBookmarks(deviceId, query.data);

  const body = bookmarksResponseSchema.parse({
    items: page.items.map(toBookmarkItem),
    nextCursor: page.nextCursor,
  });

  return jsonResponse(200, body);
});
