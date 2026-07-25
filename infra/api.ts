import { contentBucket, postsTable, sourcesTable, userActivityTable, usersTable } from './storage';

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
};

api.route('GET /v1/feed', {
  handler: 'packages/functions/src/api/feed.handler',
  link: [postsTable, usersTable, userActivityTable, sourcesTable],
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

// Compact-article reader (D23; eager generation as of D36): a plain S3 cache
// read — generation already happened during ingest (infra/pipeline.ts's
// `contentQueue`), so this route never calls the LLM on the request path.
api.route('GET /v1/posts/{postId}/content', {
  handler: 'packages/functions/src/api/content.handler',
  link: [postsTable, sourcesTable, contentBucket],
  environment: {
    POSTS_TABLE_NAME: postsTable.name,
    SOURCES_TABLE_NAME: sourcesTable.name,
    CONTENT_BUCKET_NAME: contentBucket.name,
  },
  runtime: 'nodejs22.x',
});
