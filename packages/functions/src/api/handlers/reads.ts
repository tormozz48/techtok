import {
  countTopicReads,
  effectiveQuota,
  FREE_CARD_READS_PER_DAY,
  isPlus,
  selectCardVariant,
} from '@techtok/core';
import { readsRequestSchema } from '@techtok/shared';
import { getPostsRepo, getUserActivityRepo, getUsersRepo } from '../../repos';
import { noContent, parseJsonBody, withAuth } from '../lib/http';

export const handler = withAuth(async (event, auth) => {
  const body = parseJsonBody(event, readsRequestSchema);
  if (!body.ok) return body.response;

  const readAt = new Date().toISOString();

  const foundPosts = await getPostsRepo().getByIds(body.data.postIds);
  const activity = getUserActivityRepo();
  const user = await getUsersRepo().touch(auth.userId, { email: auth.email, name: auth.name });
  const lang = user.language ?? 'en';
  const results = await Promise.all(
    foundPosts.map(async (post) => {
      const { wasNew } = await activity.markRead(
        auth.userId,
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

  const newlyReadCount = results.filter((r) => r.wasNew).length;
  const firstReadTopics = results.filter((r) => r.wasNew).map((r) => r.post.primaryTopic);
  const topicCounts = countTopicReads(firstReadTopics);
  if (Object.keys(topicCounts).length > 0) {
    await getUsersRepo().addTopicReads(auth.userId, topicCounts);
  }
  if (newlyReadCount > 0 && !isPlus(user)) {
    const timezone = user.timezone ?? 'UTC';
    const quota = effectiveQuota(user.quota, timezone);
    const remaining = Math.max(0, FREE_CARD_READS_PER_DAY - quota.cardReads);
    const chargeCount = Math.min(newlyReadCount, remaining);
    if (chargeCount > 0) {
      await getUsersRepo().incrementQuota(auth.userId, 'cardReads', timezone, chargeCount);
    }
  }

  return noContent();
});
