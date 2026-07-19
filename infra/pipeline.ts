import { postsTable } from './storage';

export const ingestCron = new sst.aws.CronV2('IngestCron', {
  schedule: 'rate(1 hour)',
  function: {
    handler: 'packages/functions/src/ingest/handler.handler',
    link: [postsTable],
    environment: { POSTS_TABLE_NAME: postsTable.name },
    runtime: 'nodejs22.x',
    timeout: '30 seconds',
  },
});
