/** Byte caps for fetchBytesWithCap/fetchTextWithCap (see @techtok/core),
 * shared by the transform/content pipeline Lambdas and the image-backfill
 * ops script. */
export const MAX_ARTICLE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** DynamoDB query page size shared by the one-shot backfill ops scripts. */
export const BACKFILL_PAGE_SIZE = 100;
