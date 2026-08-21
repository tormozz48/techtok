export const sourcesTable = new sst.aws.Dynamo('Sources', {
  fields: {
    sourceId: 'string',
  },
  primaryIndex: { hashKey: 'sourceId' },
});

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

export const usersTable = new sst.aws.Dynamo('Users', {
  fields: {
    userId: 'string',
  },
  primaryIndex: { hashKey: 'userId' },
});

export const userActivityTable = new sst.aws.Dynamo('UserActivity', {
  fields: {
    userId: 'string',
    sk: 'string',
    gsi1sk: 'string',
    gsi2sk: 'string',
  },
  primaryIndex: { hashKey: 'userId', rangeKey: 'sk' },
  globalIndexes: {
    byReadAt: { hashKey: 'userId', rangeKey: 'gsi1sk' },
    byBookmarkedAt: { hashKey: 'userId', rangeKey: 'gsi2sk' },
  },
});

const contentExpiresIn = $app.stage === 'production' ? '90 days' : '7 days';

export const rawArticlesBucket = new sst.aws.Bucket('RawArticles', {
  lifecycle: [{ id: 'expire-raw', expiresIn: contentExpiresIn }],
});

export const imagesBucket = new sst.aws.Bucket('Images', {
  access: 'cloudfront',
  lifecycle: [{ id: 'expire-images', expiresIn: contentExpiresIn }],
});

export const imagesRouter = new sst.aws.Router('ImagesRouter');
imagesRouter.routeBucket('/', imagesBucket);

export const contentBucket = new sst.aws.Bucket('Content', {
  access: 'cloudfront',
  lifecycle: [{ id: 'expire-content', expiresIn: contentExpiresIn }],
});
imagesRouter.routeBucket('/content', contentBucket);
