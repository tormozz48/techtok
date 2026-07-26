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
          defaultTags: {
            tags: {
              app: input?.stage === 'production' ? 'techtok-production' : 'techtok-dev',
              stage: input?.stage ?? 'unknown',
            },
          },
        },
      },
    };
  },
  async run() {
    // DESIGN §10 budgets for 14-day log retention; SST's own default is 1
    // month, and nothing overrode it — so every function was holding logs for
    // twice the budgeted window. Set once here rather than per function.
    $transform(sst.aws.Function, (args) => {
      args.logging = { retention: '2 weeks' };
    });

    const { imagesRouter, postsTable, sourcesTable, userActivityTable, usersTable } = await import(
      './infra/storage'
    );
    const { ingestPipeline } = await import('./infra/pipeline');
    const { api } = await import('./infra/api');
    await import('./infra/monitoring');

    return {
      api: api.url,
      postsTable: postsTable.name,
      sourcesTable: sourcesTable.name,
      usersTable: usersTable.name,
      userActivityTable: userActivityTable.name,
      ingestPipeline: ingestPipeline.arn,
      imagesCdn: imagesRouter.url,
    };
  },
});
