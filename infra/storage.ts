export const postsTable = new sst.aws.Dynamo('Posts', {
  fields: {
    postId: 'string',
    primaryTopic: 'string',
    publishedAt: 'string',
    gsi1pk: 'string',
  },
  primaryIndex: { hashKey: 'postId' },
  globalIndexes: {
    byTopic: { hashKey: 'primaryTopic', rangeKey: 'publishedAt' },
    byTime: { hashKey: 'gsi1pk', rangeKey: 'publishedAt' },
  },
  ttl: 'ttl',
});
