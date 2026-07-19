import { postsTable } from './storage';

export const api = new sst.aws.ApiGatewayV2('Api', {
  cors: {
    allowMethods: ['GET'],
    allowOrigins: ['*'],
  },
});

api.route('GET /v1/feed', {
  handler: 'packages/functions/src/api/feed.handler',
  link: [postsTable],
  environment: { POSTS_TABLE_NAME: postsTable.name },
  runtime: 'nodejs22.x',
});

api.route('GET /v1/topics', {
  handler: 'packages/functions/src/api/topics.handler',
  runtime: 'nodejs22.x',
});
