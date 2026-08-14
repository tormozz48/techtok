import { QueryClient } from '@tanstack/react-query';
import { ONE_DAY_MS } from '@/constants/time';

/** Single app-wide QueryClient, split out of _layout.tsx so non-component
 * code (readQueue.ts, api/client.ts) can invalidate cached queries — e.g.
 * ['entitlement'] — right after a request that changed it server-side,
 * instead of relying only on staleTime + focus/mount refetch triggers. */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: ONE_DAY_MS } },
});
