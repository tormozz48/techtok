import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchFeedPage } from './client';

export function useFeedQuery() {
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeedPage({ before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
  });
}
