export const neonDatabaseUrl = new sst.Secret('NeonDatabaseUrl');

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
