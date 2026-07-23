import { BEDROCK_MODEL_ID, translateQueue } from './pipeline';
import {
  contentBucket,
  countersTable,
  imagesBucket,
  imagesRouter,
  postsTable,
  rawArticlesBucket,
  sourcesTable,
  userActivityTable,
  usersTable,
} from './storage';

// Default compact-article daily cap (D23) — override via `COMPACT_DAILY_CAP`,
// same env-tunable-default pattern as every other LLM cap (D22).
const COMPACT_DAILY_CAP = process.env.COMPACT_DAILY_CAP ?? '20';

export const api = new sst.aws.ApiGatewayV2('Api', {
  cors: {
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['content-type', 'x-device-id'],
    allowOrigins: ['*'],
  },
  transform: {
    // Phase 5 rate-limit sanity check (IMPLEMENTATION_PLAN.md phase 5 task
    // 2): the account default (5000 req/s steady-state, 10000 burst) is far
    // above friends-scale usage. This is a sanity ceiling against a client
    // retry-storm bug, not per-device abuse prevention — that's explicitly
    // out of scope at this trust level (DESIGN §5).
    stage: {
      defaultRouteSettings: {
        throttlingRateLimit: 50,
        throttlingBurstLimit: 100,
      },
    },
  },
});

const feedEnvironment = {
  POSTS_TABLE_NAME: postsTable.name,
  USERS_TABLE_NAME: usersTable.name,
  USER_ACTIVITY_TABLE_NAME: userActivityTable.name,
  SOURCES_TABLE_NAME: sourcesTable.name,
  TRANSLATE_QUEUE_URL: translateQueue.url,
};

api.route('GET /v1/feed', {
  handler: 'packages/functions/src/api/feed.handler',
  link: [postsTable, usersTable, userActivityTable, sourcesTable, translateQueue],
  environment: feedEnvironment,
  runtime: 'nodejs22.x',
});

api.route('GET /v1/topics', {
  handler: 'packages/functions/src/api/topics.handler',
  runtime: 'nodejs22.x',
});

api.route('POST /v1/reads', {
  handler: 'packages/functions/src/api/reads.handler',
  link: [postsTable, userActivityTable],
  environment: {
    POSTS_TABLE_NAME: postsTable.name,
    USER_ACTIVITY_TABLE_NAME: userActivityTable.name,
  },
  runtime: 'nodejs22.x',
});

api.route('GET /v1/me', {
  handler: 'packages/functions/src/api/me.handler',
  link: [usersTable],
  environment: { USERS_TABLE_NAME: usersTable.name },
  runtime: 'nodejs22.x',
});

api.route('PUT /v1/me/topics', {
  handler: 'packages/functions/src/api/topicsPrefs.handler',
  link: [usersTable],
  environment: { USERS_TABLE_NAME: usersTable.name },
  runtime: 'nodejs22.x',
});

api.route('PUT /v1/me/language', {
  handler: 'packages/functions/src/api/languagePrefs.handler',
  link: [usersTable],
  environment: { USERS_TABLE_NAME: usersTable.name },
  runtime: 'nodejs22.x',
});

api.route('PUT /v1/me/push-token', {
  handler: 'packages/functions/src/api/pushToken.handler',
  link: [usersTable],
  environment: { USERS_TABLE_NAME: usersTable.name },
  runtime: 'nodejs22.x',
});

api.route('GET /v1/history', {
  handler: 'packages/functions/src/api/history.handler',
  link: [userActivityTable],
  environment: { USER_ACTIVITY_TABLE_NAME: userActivityTable.name },
  runtime: 'nodejs22.x',
});

api.route('POST /v1/bookmarks', {
  handler: 'packages/functions/src/api/bookmarkCreate.handler',
  link: [postsTable, userActivityTable],
  environment: {
    POSTS_TABLE_NAME: postsTable.name,
    USER_ACTIVITY_TABLE_NAME: userActivityTable.name,
  },
  runtime: 'nodejs22.x',
});

api.route('DELETE /v1/bookmarks/{postId}', {
  handler: 'packages/functions/src/api/bookmarkDelete.handler',
  link: [userActivityTable],
  environment: { USER_ACTIVITY_TABLE_NAME: userActivityTable.name },
  runtime: 'nodejs22.x',
});

api.route('GET /v1/bookmarks', {
  handler: 'packages/functions/src/api/bookmarkList.handler',
  link: [userActivityTable],
  environment: { USER_ACTIVITY_TABLE_NAME: userActivityTable.name },
  runtime: 'nodejs22.x',
});

// Compact-article reader (D23, phase 9): synchronous generate-or-cache-hit,
// 30s ceiling per DESIGN §7.5's own sync ceiling.
api.route('GET /v1/posts/{postId}/content', {
  handler: 'packages/functions/src/api/content.handler',
  link: [postsTable, sourcesTable, countersTable, rawArticlesBucket, imagesBucket, contentBucket],
  environment: {
    POSTS_TABLE_NAME: postsTable.name,
    SOURCES_TABLE_NAME: sourcesTable.name,
    COUNTERS_TABLE_NAME: countersTable.name,
    RAW_ARTICLES_BUCKET_NAME: rawArticlesBucket.name,
    IMAGES_BUCKET_NAME: imagesBucket.name,
    IMAGES_CDN_BASE_URL: imagesRouter.url,
    CONTENT_BUCKET_NAME: contentBucket.name,
    BEDROCK_MODEL_ID,
    COMPACT_DAILY_CAP,
  },
  permissions: [
    {
      // Bedrock isn't an SST-linkable resource, so its invoke permission is
      // granted directly. Scoped to InvokeModel only, not full bedrock:*.
      actions: ['bedrock:InvokeModel'],
      resources: [
        'arn:aws:bedrock:*::foundation-model/*',
        'arn:aws:bedrock:*:*:inference-profile/*',
      ],
    },
  ],
  runtime: 'nodejs22.x',
  // D23's own synchronous ceiling — includes the article fetch, figure
  // mirroring, and one Bedrock round trip (with one repair-retry).
  timeout: '30 seconds',
});
