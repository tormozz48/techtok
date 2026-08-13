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

// Matches Posts' own 90-day TTL on production, since this content outlives
// its post by design only as long as the post itself does. `dev` never
// serves these to a real reader for any length of time, so it gets a much
// shorter expiry purely to cap storage cost on a stage that ingests on the
// same schedule as production.
const contentExpiresIn = $app.stage === 'production' ? '90 days' : '7 days';

export const rawArticlesBucket = new sst.aws.Bucket('RawArticles', {
  lifecycle: [{ id: 'expire-raw', expiresIn: contentExpiresIn }],
});

// Phase 4: mirrors article images (originally hotlinked from the source site)
// so the app serves them from our own CDN instead — kills hotlink rot.
export const imagesBucket = new sst.aws.Bucket('Images', {
  access: 'cloudfront',
  lifecycle: [{ id: 'expire-images', expiresIn: contentExpiresIn }],
});

export const imagesRouter = new sst.aws.Router('ImagesRouter');
imagesRouter.routeBucket('/', imagesBucket);

// Phase 9: compact-article reader JSON (D23), cached at
// `content/<postId>/<lang>.json`, on the same router/CDN as mirrored images
// — `/content` beats the `/` fallback route since Router matches the longest
// path prefix.
export const contentBucket = new sst.aws.Bucket('Content', {
  access: 'cloudfront',
  lifecycle: [{ id: 'expire-content', expiresIn: contentExpiresIn }],
});
imagesRouter.routeBucket('/content', contentBucket);
