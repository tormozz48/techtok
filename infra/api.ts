import { contentJobQueue, translateQueue } from './pipeline';
import {
  contentBucket,
  contentJobsTable,
  postsTable,
  sourcesTable,
  userActivityTable,
  usersTable,
} from './storage';

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

// Compact-article reader (D23, job-polling transport as of D27): starts
// generation (cache hit completes the job inline, a miss enqueues to
// `ContentJobQueue` — see infra/pipeline.ts) and returns a `jobId`
// immediately. The actual ~11s generation runs in the queue's consumer, off
// this request path entirely.
api.route('POST /v1/posts/{postId}/content', {
  handler: 'packages/functions/src/api/content.handler',
  link: [postsTable, contentBucket, contentJobsTable, contentJobQueue],
  environment: {
    POSTS_TABLE_NAME: postsTable.name,
    CONTENT_BUCKET_NAME: contentBucket.name,
    CONTENT_JOBS_TABLE_NAME: contentJobsTable.name,
    CONTENT_JOB_QUEUE_URL: contentJobQueue.url,
  },
  runtime: 'nodejs22.x',
});

api.route('GET /v1/posts/{postId}/content/status', {
  handler: 'packages/functions/src/api/contentStatus.handler',
  link: [contentJobsTable],
  environment: {
    CONTENT_JOBS_TABLE_NAME: contentJobsTable.name,
  },
  runtime: 'nodejs22.x',
});
