import { postsTable, sourcesTable, userActivityTable, usersTable } from './storage';

// Phase 5 optional item: daily top-N-unread push digest (IMPLEMENTATION_PLAN.md
// phase 5 task 4). Runs once a day; friends-scale user count makes a Users
// scan for push-token holders fine (mirrors the Sources scan precedent).
export const digestCron = new sst.aws.Cron('DigestCron', {
  schedule: 'rate(1 day)',
  function: {
    handler: 'packages/functions/src/pipeline/digest.handler',
    link: [usersTable, postsTable, userActivityTable, sourcesTable],
    environment: {
      USERS_TABLE_NAME: usersTable.name,
      POSTS_TABLE_NAME: postsTable.name,
      USER_ACTIVITY_TABLE_NAME: userActivityTable.name,
      SOURCES_TABLE_NAME: sourcesTable.name,
    },
    runtime: 'nodejs22.x',
    timeout: '60 seconds',
  },
});
