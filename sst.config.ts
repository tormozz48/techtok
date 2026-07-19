/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'techtok',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: input?.stage === 'production',
      home: 'aws',
      providers: {
        aws: {
          region: 'eu-central-1',
        },
      },
    };
  },
  async run() {
    const { postsTable, userActivityTable, usersTable } = await import('./infra/storage');
    await import('./infra/pipeline');
    const { api } = await import('./infra/api');

    return {
      api: api.url,
      postsTable: postsTable.name,
      usersTable: usersTable.name,
      userActivityTable: userActivityTable.name,
    };
  },
});
