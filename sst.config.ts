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
    $transform(sst.aws.Function, (args) => {
      args.logging = { retention: $app.stage === 'production' ? '2 weeks' : '3 days' };
    });

    const { imagesRouter } = await import('./infra/storage');
    const { ingestPipeline, seedSourcesFn } = await import('./infra/pipeline');
    const { api } = await import('./infra/api');
    await import('./infra/monitoring');

    return {
      api: api.url,
      ingestPipeline: ingestPipeline.arn,
      seedSources: seedSourcesFn.arn,
      imagesCdn: imagesRouter.url,
    };
  },
});
