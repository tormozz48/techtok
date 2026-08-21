import { isAfter, parseISO } from 'date-fns';
import type { Entitlement } from './entitlement.types';

export function isPlus(
  user: { readonly entitlement?: Entitlement },
  now: Date = new Date(),
): boolean {
  const entitlement = user.entitlement;
  if (!entitlement || entitlement.plan !== 'plus') return false;
  if (!entitlement.expiresAt) return true;
  return isAfter(parseISO(entitlement.expiresAt), now);
}
