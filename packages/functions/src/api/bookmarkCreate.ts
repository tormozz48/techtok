import { bookmarkCreateRequestSchema } from '@techtok/shared';
import { getPostsRepo, getUserActivityRepo } from '../repos';
import { errorResponse, noContent, parseJsonBody, withDeviceId } from './http';

export const handler = withDeviceId(async (event, deviceId) => {
  const body = parseJsonBody(event, bookmarkCreateRequestSchema);
  if (!body.ok) return body.response;

  const [post] = await getPostsRepo().getByIds([body.data.postId]);
  if (!post) {
    return errorResponse(404, 'post_not_found', 'No post with that id');
  }

  await getUserActivityRepo().addBookmark(deviceId, post.postId, {
    cardTitle: post.cardTitle,
    sourceName: post.sourceName,
    url: post.url,
  });

  return noContent();
});
