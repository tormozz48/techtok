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
    // Bookmarks (`bm#<postId>` sort-key space, DESIGN §6) get their own GSI
    // rather than sharing byReadAt, so bookmark pagination stays Limit-accurate
    // instead of needing a post-fetch filter over mixed read#/bm# items.
    byBookmarkedAt: { hashKey: 'userId', rangeKey: 'gsi2sk' },
  },
});

export const rawArticlesBucket = new sst.aws.Bucket('RawArticles', {
  lifecycle: [{ id: 'expire-raw', expiresIn: '90 days' }],
});

// Phase 4: mirrors article images (originally hotlinked from the source site)
// so the app serves them from our own CDN instead — kills hotlink rot, and
// matches Posts' own 90-day TTL since a mirrored image outlives its post by
// design only as long as the post itself does.
export const imagesBucket = new sst.aws.Bucket('Images', {
  access: 'cloudfront',
  lifecycle: [{ id: 'expire-images', expiresIn: '90 days' }],
});

export const imagesRouter = new sst.aws.Router('ImagesRouter');
imagesRouter.routeBucket('/', imagesBucket);

// Enforces the daily LLM transform cap (DESIGN §6, §7.4): one item per day,
// keyed `transforms#<yyyy-mm-dd>`, atomically incremented by the transform
// Lambda before every Bedrock call.
export const countersTable = new sst.aws.Dynamo('Counters', {
  fields: {
    counterId: 'string',
  },
  primaryIndex: { hashKey: 'counterId' },
});
