import { useQuery } from '@tanstack/react-query';
import { fetchEntitlement } from './client';

/** Short staleTime — this reflects a fast-moving daily counter that other
 * requests (reads, reader opens) change server-side without this app
 * knowing, unlike the feed's own 5-minute staleTime. */
const ENTITLEMENT_STALE_TIME_MS = 30 * 1000;

export function useEntitlementQuery() {
  return useQuery({
    queryKey: ['entitlement'],
    queryFn: fetchEntitlement,
    staleTime: ENTITLEMENT_STALE_TIME_MS,
  });
}
