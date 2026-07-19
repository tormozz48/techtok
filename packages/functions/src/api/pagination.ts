import type { PostRecord } from '@techtok/core';

/**
 * The feed is one page short of the whole table, so a short page always
 * means "no more posts" — anything else, the caller pages again from the
 * last item's timestamp.
 */
export function computeNextBefore(posts: PostRecord[], limit: number): string | null {
  if (posts.length < limit) return null;
  return posts.at(-1)?.publishedAt ?? null;
}
