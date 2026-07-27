import { contentBucket, postsTable, sourcesTable, userActivityTable, usersTable } from './storage';

export const api = new sst.aws.ApiGatewayV2('Api', {
  // This is a mobile-only API with no browser client, so CORS is pointless
  // attack surface: native apps send no `Origin` and are not subject to CORS,
  // while permissive CORS would let any website's JS call the API from a
  // browser. `cors: false` disables it entirely — note that omitting the
  // property (or `cors: true`) defaults to allow-all `*`, so this must be an
  // explicit `false`. CORS only constrains browsers, not scripts/curl; it's a
  // free reduction of casual web-based abuse, not an auth boundary (DESIGN §5).
  cors: false,
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
  handler: 'packages/functions/src/api/handlers/feed.handler',
  link: [postsTable, usersTable, userActivityTable, sourcesTable],
  environment: feedEnvironment,
  runtime: 'nodejs22.x',
});

api.route('GET /v1/topics', {
  handler: 'packages/functions/src/api/handlers/topics.handler',
  runtime: 'nodejs22.x',
});

// Public catalog, like GET /v1/topics — lets the app render a mute picker
// without hardcoding the source list.
api.route('GET /v1/sources', {
  handler: 'packages/functions/src/api/handlers/sources.handler',
  link: [sourcesTable],
  environment: { SOURCES_TABLE_NAME: sourcesTable.name },
  runtime: 'nodejs22.x',
});

api.route('POST /v1/reads', {
  handler: 'packages/functions/src/api/handlers/reads.handler',
  link: [postsTable, userActivityTable, usersTable],
  environment: {
    POSTS_TABLE_NAME: postsTable.name,
    USER_ACTIVITY_TABLE_NAME: userActivityTable.name,
    USERS_TABLE_NAME: usersTable.name,
  },
  runtime: 'nodejs22.x',
});

api.route('GET /v1/me', {
  handler: 'packages/functions/src/api/handlers/me.handler',
  link: [usersTable],
  environment: { USERS_TABLE_NAME: usersTable.name },
  runtime: 'nodejs22.x',
});

api.route('PUT /v1/me/topics', {
  handler: 'packages/functions/src/api/handlers/topicsPrefs.handler',
  link: [usersTable],
  environment: { USERS_TABLE_NAME: usersTable.name },
  runtime: 'nodejs22.x',
});

api.route('PUT /v1/me/language', {
  handler: 'packages/functions/src/api/handlers/languagePrefs.handler',
  link: [usersTable],
  environment: { USERS_TABLE_NAME: usersTable.name },
  runtime: 'nodejs22.x',
});

api.route('PUT /v1/me/muted-sources', {
  handler: 'packages/functions/src/api/handlers/mutedSourcesPrefs.handler',
  link: [usersTable],
  environment: { USERS_TABLE_NAME: usersTable.name },
  runtime: 'nodejs22.x',
});

api.route('GET /v1/history', {
  handler: 'packages/functions/src/api/handlers/history.handler',
  link: [userActivityTable],
  environment: { USER_ACTIVITY_TABLE_NAME: userActivityTable.name },
  runtime: 'nodejs22.x',
});

api.route('POST /v1/bookmarks', {
  handler: 'packages/functions/src/api/handlers/bookmarkCreate.handler',
  link: [postsTable, usersTable, userActivityTable],
  environment: {
    POSTS_TABLE_NAME: postsTable.name,
    USERS_TABLE_NAME: usersTable.name,
    USER_ACTIVITY_TABLE_NAME: userActivityTable.name,
  },
  runtime: 'nodejs22.x',
});

api.route('DELETE /v1/bookmarks/{postId}', {
  handler: 'packages/functions/src/api/handlers/bookmarkDelete.handler',
  link: [userActivityTable],
  environment: { USER_ACTIVITY_TABLE_NAME: userActivityTable.name },
  runtime: 'nodejs22.x',
});

api.route('GET /v1/bookmarks', {
  handler: 'packages/functions/src/api/handlers/bookmarkList.handler',
  link: [userActivityTable],
  environment: { USER_ACTIVITY_TABLE_NAME: userActivityTable.name },
  runtime: 'nodejs22.x',
});

// Compact-article reader (D23; eager generation as of D36): a plain S3 cache
// read — generation already happened during ingest (infra/pipeline.ts's
// `contentQueue`), so this route never calls the LLM on the request path.
api.route('GET /v1/posts/{postId}/content', {
  handler: 'packages/functions/src/api/handlers/content.handler',
  link: [postsTable, sourcesTable, contentBucket],
  environment: {
    POSTS_TABLE_NAME: postsTable.name,
    SOURCES_TABLE_NAME: sourcesTable.name,
    CONTENT_BUCKET_NAME: contentBucket.name,
  },
  runtime: 'nodejs22.x',
});
