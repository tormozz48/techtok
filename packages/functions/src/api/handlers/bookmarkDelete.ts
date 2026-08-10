import { getUserActivityRepo } from '../../repos';
import { errorResponse, noContent, withAuth } from '../lib/http';

export const handler = withAuth(async (event, auth) => {
  const postId = event.pathParameters?.postId;
  if (!postId) {
    return errorResponse(400, 'missing_post_id', 'postId path parameter is required');
  }

  await getUserActivityRepo().removeBookmark(auth.userId, postId);

  return noContent();
});
