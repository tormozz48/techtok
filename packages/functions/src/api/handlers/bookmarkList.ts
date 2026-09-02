import { bookmarksQuerySchema, bookmarksResponseSchema } from '@techtok/shared';
import { getUserActivityRepo } from '../../repos';
import { jsonResponse, parseQuery, withAuth } from '../lib/http';
import { toBookmarkItem } from '../transformers/toBookmarkItem';

export const handler = withAuth(async (event, auth) => {
  const query = parseQuery(event, bookmarksQuerySchema);
  if (!query.ok) return query.response;

  const page = await getUserActivityRepo().queryBookmarks(auth.userId, query.data);

  const body = bookmarksResponseSchema.parse({
    items: page.items.map(toBookmarkItem),
    nextCursor: page.nextCursor,
  });

  return jsonResponse(200, body);
});
