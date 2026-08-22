import { useInfiniteQuery } from '@tanstack/react-query';
import { useLanguageStore } from '@/state/languageStore';
import { fetchFeedPage } from './client';

const FEED_STALE_TIME_MS = 5 * 60 * 1000;

export function useFeedQuery() {
  const language = useLanguageStore((state) => state.language);

  return useInfiniteQuery({
    queryKey: ['feed', language],
    queryFn: ({ pageParam }) => fetchFeedPage({ before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
    staleTime: FEED_STALE_TIME_MS,
  });
}
