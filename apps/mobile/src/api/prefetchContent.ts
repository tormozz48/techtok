import type { QueryClient } from '@tanstack/react-query';
import type { ContentResponse, Language } from '@techtok/shared';
import { Image } from 'expo-image';
import { fetchPostContent } from './client';

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
