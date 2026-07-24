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

// Phase 9: compact-article reader JSON (D23), cached at
// `content/<postId>/<lang>.json`, on the same router/CDN as mirrored images
// — `/content` beats the `/` fallback route since Router matches the longest
// path prefix. Matches Posts' own 90-day TTL for the same reason as images.
export const contentBucket = new sst.aws.Bucket('Content', {
  access: 'cloudfront',
  lifecycle: [{ id: 'expire-content', expiresIn: '90 days' }],
});
imagesRouter.routeBucket('/content', contentBucket);
