import { selectCardVariant } from '@techtok/core';
import { bookmarkCreateRequestSchema } from '@techtok/shared';
import { getPostsRepo, getUserActivityRepo, getUsersRepo } from '../../repos';
import { errorResponse, noContent, parseJsonBody, withAuth } from '../lib/http';

export const handler = withAuth(async (event, auth) => {
  const body = parseJsonBody(event, bookmarkCreateRequestSchema);
  if (!body.ok) return body.response;

  const [post] = await getPostsRepo().getByIds([body.data.postId]);
  if (!post) {
    return errorResponse(404, 'post_not_found', 'No post with that id');
  }

  const user = await getUsersRepo().touch(auth.userId, { email: auth.email, name: auth.name });
  const lang = user.language ?? 'en';

  await getUserActivityRepo().addBookmark(auth.userId, post.postId, {
    cardTitle: selectCardVariant(post, lang).cardTitle,
    sourceName: post.sourceName,
    url: post.url,
    primaryTopic: post.primaryTopic,
  });

  return noContent();
});
