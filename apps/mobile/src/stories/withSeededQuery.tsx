import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

/** Gives a page story its own QueryClient (overriding preview.tsx's shared
 * one) pre-seeded with the exact query key/data the page reads, so it
 * renders populated immediately instead of hitting the real API client
 * (which throws — no EXPO_PUBLIC_API_URL in this environment). */
export function withSeededQuery(queryKey: unknown[], data: unknown) {
  return (Story: () => ReactElement) => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKey, data);
    return (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    );
  };
}
