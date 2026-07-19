import { postsTable, userActivityTable, usersTable } from './storage';

export const api = new sst.aws.ApiGatewayV2('Api', {
  cors: {
    allowMethods: ['GET', 'POST', 'PUT'],
    allowHeaders: ['content-type', 'x-device-id'],
    allowOrigins: ['*'],
  },
});

const feedEnvironment = {
  POSTS_TABLE_NAME: postsTable.name,
  USERS_TABLE_NAME: usersTable.name,
  USER_ACTIVITY_TABLE_NAME: userActivityTable.name,
};

api.route('GET /v1/feed', {
  handler: 'packages/functions/src/api/feed.handler',
  link: [postsTable, usersTable, userActivityTable],
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

api.route('GET /v1/history', {
  handler: 'packages/functions/src/api/history.handler',
  link: [userActivityTable],
  environment: { USER_ACTIVITY_TABLE_NAME: userActivityTable.name },
  runtime: 'nodejs22.x',
});
