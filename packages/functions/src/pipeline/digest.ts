import { Logger } from '@aws-lambda-powertools/logger';
import {
  buildFeed,
  composeDigestMessage,
  createDynamoClient,
  createExpoPushSender,
  createPostsRepo,
  createSourcesRepo,
  createSourceWeightsCache,
  createUserActivityRepo,
  createUsersRepo,
  type ExpoPushMessage,
} from '@techtok/core';
import { requireEnv } from '../env';

const logger = new Logger({ serviceName: 'digest' });
const DIGEST_LIMIT = 5;

/**
 * Daily digest (IMPLEMENTATION_PLAN.md phase 5, optional item 4): for every
 * user with a registered push token, builds their top-N unread cards via the
 * same `buildFeed` the live feed endpoint uses, and sends one push per user
 * through Expo's push API. Users scale is friends-only, so a table scan for
 * push-token holders is fine (mirrors the `Sources` scan precedent).
 */
export async function handler(): Promise<void> {
  const client = createDynamoClient();
  const users = createUsersRepo(client, requireEnv('USERS_TABLE_NAME'));
  const posts = createPostsRepo(client, requireEnv('POSTS_TABLE_NAME'));
  const activity = createUserActivityRepo(client, requireEnv('USER_ACTIVITY_TABLE_NAME'));
  const sourceWeights = createSourceWeightsCache(
    createSourcesRepo(client, requireEnv('SOURCES_TABLE_NAME')),
  );
  const pushSender = createExpoPushSender();

  const subscribers = await users.listWithPushTokens();
  const messages: ExpoPushMessage[] = [];

  for (const user of subscribers) {
    if (!user.pushToken) continue;

    const page = await buildFeed(
      {
        queryByTopic: (topic, opts) => posts.queryByTopic(topic, opts),
        getReadSet: (postIds) => activity.getReadSet(user.userId, postIds),
        getSourceWeights: () => sourceWeights.getSourceWeights(),
      },
      { userTopics: user.topics, limit: DIGEST_LIMIT },
    );

    const message = composeDigestMessage(user.pushToken, page.items);
    if (message) messages.push(message);
  }

  if (messages.length > 0) {
    await pushSender.send(messages);
  }

  logger.info('digest complete', { subscribers: subscribers.length, sent: messages.length });
}
