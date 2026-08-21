import { useQuery } from '@tanstack/react-query';
import { fetchEntitlement } from './client';

const ENTITLEMENT_STALE_TIME_MS = 30 * 1000;

export function useEntitlementQuery() {
  return useQuery({
    queryKey: ['entitlement'],
    queryFn: fetchEntitlement,
    staleTime: ENTITLEMENT_STALE_TIME_MS,
  });
}
