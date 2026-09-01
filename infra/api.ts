import { GOOGLE_OAUTH_WEB_CLIENT_ID } from './auth';
import { contentBucket, neonDatabaseUrl, postsTable } from './storage';

export const api = new sst.aws.ApiGatewayV2('Api', {
  cors: false,
  transform: {
    stage: {
      defaultRouteSettings: {
        throttlingRateLimit: 50,
        throttlingBurstLimit: 100,
      },
    },
  },
});

const googleAuthorizer = api.addAuthorizer({
  name: 'GoogleJwt',
  jwt: {
    issuer: 'https://accounts.google.com',
    audiences: [GOOGLE_OAUTH_WEB_CLIENT_ID],
  },
});
const googleAuth = { auth: { jwt: { authorizer: googleAuthorizer.id } } };

const feedEnvironment = {
  POSTS_TABLE_NAME: postsTable.name,
  DATABASE_URL: neonDatabaseUrl.value,
};

api.route(
  'GET /v1/feed',
  {
    handler: 'packages/functions/src/api/handlers/feed.handler',
    link: [postsTable, neonDatabaseUrl],
    environment: feedEnvironment,
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route('GET /v1/topics', {
  handler: 'packages/functions/src/api/handlers/topics.handler',
  runtime: 'nodejs22.x',
});

api.route('GET /v1/sources', {
  handler: 'packages/functions/src/api/handlers/sources.handler',
  link: [neonDatabaseUrl],
  environment: { DATABASE_URL: neonDatabaseUrl.value },
  runtime: 'nodejs22.x',
});

api.route(
  'POST /v1/events',
  {
    handler: 'packages/functions/src/api/handlers/events.handler',
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route(
  'POST /v1/reads',
  {
    handler: 'packages/functions/src/api/handlers/reads.handler',
    link: [postsTable, neonDatabaseUrl],
    environment: {
      POSTS_TABLE_NAME: postsTable.name,
      DATABASE_URL: neonDatabaseUrl.value,
    },
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route(
  'GET /v1/me',
  {
    handler: 'packages/functions/src/api/handlers/me.handler',
    link: [neonDatabaseUrl],
    environment: { DATABASE_URL: neonDatabaseUrl.value },
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route(
  'DELETE /v1/me',
  {
    handler: 'packages/functions/src/api/handlers/accountDelete.handler',
    link: [neonDatabaseUrl],
    environment: { DATABASE_URL: neonDatabaseUrl.value },
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route(
  'PUT /v1/me/topics',
  {
    handler: 'packages/functions/src/api/handlers/topicsPrefs.handler',
    link: [neonDatabaseUrl],
    environment: { DATABASE_URL: neonDatabaseUrl.value },
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route(
  'PUT /v1/me/language',
  {
    handler: 'packages/functions/src/api/handlers/languagePrefs.handler',
    link: [neonDatabaseUrl],
    environment: { DATABASE_URL: neonDatabaseUrl.value },
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route(
  'PUT /v1/me/muted-sources',
  {
    handler: 'packages/functions/src/api/handlers/mutedSourcesPrefs.handler',
    link: [neonDatabaseUrl],
    environment: { DATABASE_URL: neonDatabaseUrl.value },
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route(
  'GET /v1/history',
  {
    handler: 'packages/functions/src/api/handlers/history.handler',
    link: [neonDatabaseUrl],
    environment: { DATABASE_URL: neonDatabaseUrl.value },
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route(
  'POST /v1/bookmarks',
  {
    handler: 'packages/functions/src/api/handlers/bookmarkCreate.handler',
    link: [postsTable, neonDatabaseUrl],
    environment: {
      POSTS_TABLE_NAME: postsTable.name,
      DATABASE_URL: neonDatabaseUrl.value,
    },
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route(
  'DELETE /v1/bookmarks/{postId}',
  {
    handler: 'packages/functions/src/api/handlers/bookmarkDelete.handler',
    link: [neonDatabaseUrl],
    environment: { DATABASE_URL: neonDatabaseUrl.value },
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route(
  'GET /v1/bookmarks',
  {
    handler: 'packages/functions/src/api/handlers/bookmarkList.handler',
    link: [neonDatabaseUrl],
    environment: { DATABASE_URL: neonDatabaseUrl.value },
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route(
  'GET /v1/posts/{postId}/content',
  {
    handler: 'packages/functions/src/api/handlers/content.handler',
    link: [postsTable, contentBucket, neonDatabaseUrl],
    environment: {
      POSTS_TABLE_NAME: postsTable.name,
      CONTENT_BUCKET_NAME: contentBucket.name,
      DATABASE_URL: neonDatabaseUrl.value,
    },
    runtime: 'nodejs22.x',
  },
  googleAuth,
);

api.route(
  'GET /v1/me/entitlement',
  {
    handler: 'packages/functions/src/api/handlers/entitlement.handler',
    link: [neonDatabaseUrl],
    environment: { DATABASE_URL: neonDatabaseUrl.value },
    runtime: 'nodejs22.x',
  },
  googleAuth,
);
