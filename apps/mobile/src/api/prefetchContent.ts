import type { QueryClient } from '@tanstack/react-query';
import type { ContentResponse, Language } from '@techtok/shared';
import { Image } from 'expo-image';
import { fetchPostContent } from './client';

/** Same query key shape the reader (post/[id].tsx) uses, so a prefetch here
 * is a cache hit there. A no-op if fresh data is already cached — safe to
 * call repeatedly (e.g. once per item on every Saved-screen data refresh).
 * Also prefetches every in-body figure (D61) — prefetching the article JSON
 * alone doesn't touch expo-image's cache, so without this a prefetched-but-
 * never-opened article would show broken images offline despite having its
 * text. Returns the underlying promise so callers *can* await it (tests do);
 * call sites in the app fire-and-forget it instead, same as any other
 * prefetch. */
export function prefetchPostContent(
  queryClient: QueryClient,
  postId: string,
  language: Language,
): Promise<void> {
  return queryClient
    .prefetchQuery({
      queryKey: ['content', postId, language],
      queryFn: () => fetchPostContent(postId, language, 'prefetch'),
    })
    .then(() => {
      const content = queryClient.getQueryData<ContentResponse>(['content', postId, language]);
      if (!content?.available) return;
      for (const figure of content.figures) {
        Image.prefetch(figure.url);
      }
    });
}
