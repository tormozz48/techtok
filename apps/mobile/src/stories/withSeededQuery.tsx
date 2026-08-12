import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

/** Gives a page story its own QueryClient (overriding preview.tsx's shared
 * one) pre-seeded with the exact query key/data the page reads, so it
 * renders populated immediately instead of hitting the real API client
 * (which throws — no EXPO_PUBLIC_API_URL in this environment). */
export function withSeededQuery(queryKey: unknown[], data: unknown) {
  return withSeededQueries([{ queryKey, data }]);
}

/** Multi-key variant of `withSeededQuery` — for a page that reads more than
 * one query (e.g. settings' sources + entitlement), since two `Story`-level
 * `QueryClientProvider`s would just nest and the innermost would shadow the
 * outer one's seeded data entirely, not merge with it. */
export function withSeededQueries(seeds: Array<{ queryKey: unknown[]; data: unknown }>) {
  return (Story: () => ReactElement) => {
    const queryClient = new QueryClient();
    for (const { queryKey, data } of seeds) {
      queryClient.setQueryData(queryKey, data);
    }
    return (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    );
  };
}
