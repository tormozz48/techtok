import { getUserActivityRepo } from '../../repos';
import { errorResponse, noContent, withDeviceId } from '../lib/http';

export const handler = withDeviceId(async (event, deviceId) => {
  const postId = event.pathParameters?.postId;
  if (!postId) {
    return errorResponse(400, 'missing_post_id', 'postId path parameter is required');
  }

  await getUserActivityRepo().removeBookmark(deviceId, postId);

  return noContent();
});
