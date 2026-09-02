import { QueryClient } from '@tanstack/react-query';
import { ONE_DAY_MS } from '@/constants/time';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: ONE_DAY_MS } },
});
