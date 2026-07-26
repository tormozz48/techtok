import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchFeedPage } from './client';

/** How long a fetched feed stays fresh — foregrounding the app after this
 * triggers a background refetch (focusManager wiring in _layout.tsx). */
const FEED_STALE_TIME_MS = 5 * 60 * 1000;

export function useFeedQuery() {
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeedPage({ before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
    staleTime: FEED_STALE_TIME_MS,
  });
}
