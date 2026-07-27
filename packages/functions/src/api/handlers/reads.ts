import { countTopicReads, selectCardVariant } from '@techtok/core';
import { readsRequestSchema } from '@techtok/shared';
import { getPostsRepo, getUserActivityRepo, getUsersRepo } from '../../repos';
import { noContent, parseJsonBody, withDeviceId } from '../lib/http';

export const handler = withDeviceId(async (event, deviceId) => {
  const body = parseJsonBody(event, readsRequestSchema);
  if (!body.ok) return body.response;

  const readAt = new Date().toISOString();

  // A postId can be missing (already TTL'd) — that's a content-level gap, not
  // an infra failure, so it's skipped rather than thrown.
  const foundPosts = await getPostsRepo().getByIds(body.data.postIds);
  const activity = getUserActivityRepo();
  const user = await getUsersRepo().touch(deviceId);
  const lang = user.language ?? 'en';
  const results = await Promise.all(
    foundPosts.map(async (post) => {
      // Snapshot the title in the user's language at read time (D21), same
      // as the feed card — otherwise History always shows the English title
      // regardless of the user's selected language.
      const { wasNew } = await activity.markRead(
        deviceId,
        post.postId,
        {
          cardTitle: selectCardVariant(post, lang).cardTitle,
          sourceName: post.sourceName,
          url: post.url,
          primaryTopic: post.primaryTopic,
        },
        readAt,
      );
      return { post, wasNew };
    }),
  );

  // This endpoint is documented idempotent (a retried postId just overwrites
  // readAt/snapshot), but the affinity counter it drives is not — only a
  // post's first-ever read should count toward it.
  const firstReadTopics = results.filter((r) => r.wasNew).map((r) => r.post.primaryTopic);
  const topicCounts = countTopicReads(firstReadTopics);
  if (Object.keys(topicCounts).length > 0) {
    await getUsersRepo().addTopicReads(deviceId, topicCounts);
  }

  return noContent();
});
