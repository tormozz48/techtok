import { selectCardVariant } from '@techtok/core';
import { bookmarkCreateRequestSchema } from '@techtok/shared';
import { getPostsRepo, getUserActivityRepo, getUsersRepo } from '../../repos';
import { errorResponse, noContent, parseJsonBody, withDeviceId } from '../lib/http';

export const handler = withDeviceId(async (event, deviceId) => {
  const body = parseJsonBody(event, bookmarkCreateRequestSchema);
  if (!body.ok) return body.response;

  const [post] = await getPostsRepo().getByIds([body.data.postId]);
  if (!post) {
    return errorResponse(404, 'post_not_found', 'No post with that id');
  }

  const user = await getUsersRepo().touch(deviceId);
  const lang = user.language ?? 'en';

  // Snapshot the title in the user's language at bookmark time (D21), same
  // as the feed card — otherwise Saved always shows the English title
  // regardless of the user's selected language.
  await getUserActivityRepo().addBookmark(deviceId, post.postId, {
    cardTitle: selectCardVariant(post, lang).cardTitle,
    sourceName: post.sourceName,
    url: post.url,
    primaryTopic: post.primaryTopic,
  });

  return noContent();
});
