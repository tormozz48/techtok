import { readsRequestSchema } from '@techtok/shared';
import { getPostsRepo, getUserActivityRepo } from '../../repos';
import { noContent, parseJsonBody, withDeviceId } from '../lib/http';

export const handler = withDeviceId(async (event, deviceId) => {
  const body = parseJsonBody(event, readsRequestSchema);
  if (!body.ok) return body.response;

  const readAt = new Date().toISOString();

  // A postId can be missing (already TTL'd) — that's a content-level gap, not
  // an infra failure, so it's skipped rather than thrown.
  const foundPosts = await getPostsRepo().getByIds(body.data.postIds);
  const activity = getUserActivityRepo();
  await Promise.all(
    foundPosts.map((post) =>
      activity.markRead(
        deviceId,
        post.postId,
        { cardTitle: post.cardTitle, sourceName: post.sourceName, url: post.url },
        readAt,
      ),
    ),
  );

  return noContent();
});
