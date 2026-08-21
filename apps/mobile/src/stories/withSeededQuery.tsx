import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

export function withSeededQuery(queryKey: unknown[], data: unknown) {
  return withSeededQueries([{ queryKey, data }]);
}

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
