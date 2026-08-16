import { useInfiniteQuery } from '@tanstack/react-query';
import { useLanguageStore } from '@/state/languageStore';
import { fetchFeedPage } from './client';

/** How long a fetched feed stays fresh — foregrounding the app after this
 * triggers a background refetch (focusManager wiring in _layout.tsx). */
const FEED_STALE_TIME_MS = 5 * 60 * 1000;

export function useFeedQuery() {
  // Keyed by language (unlike the reader's ['content', id, lang], this was
  // missing it entirely) — the feed's card copy is server-rendered in
  // whatever language `Users.language` says (feed.ts), so a stale persisted
  // page fetched under a since-changed language would otherwise keep
  // showing through this query's own staleTime/gcTime and the day-long
  // AsyncStorage persistence in _layout.tsx, independent of what the app's
  // local language state currently displays.
  const language = useLanguageStore((state) => state.language);

  return useInfiniteQuery({
    queryKey: ['feed', language],
    queryFn: ({ pageParam }) => fetchFeedPage({ before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
    staleTime: FEED_STALE_TIME_MS,
  });
}
