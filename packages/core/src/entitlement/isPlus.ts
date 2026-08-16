import { isAfter, parseISO } from 'date-fns';
import type { Entitlement } from './entitlement.types';

/**
 * Whether a user currently has Plus (D70) — consulted by the feed/content
 * quota gates and will be reused unchanged by phase 22's extended-compact
 * gate. A missing `expiresAt` on a `plus` entitlement is treated as
 * open-ended (the manual-grant path never sets one); Play-sourced grants
 * always carry a real `expiresAt`.
 */
export function isPlus(
  user: { readonly entitlement?: Entitlement },
  now: Date = new Date(),
): boolean {
  const entitlement = user.entitlement;
  if (!entitlement || entitlement.plan !== 'plus') return false;
  if (!entitlement.expiresAt) return true;
  return isAfter(parseISO(entitlement.expiresAt), now);
}
