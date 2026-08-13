/** Where an entitlement grant came from (D70) — `manual` is the maintainer's
 * own ops-script grant/comp path; `play` will be Play Billing's verify
 * callback (phase 21). Both write through the same `UsersRepo.grantEntitlement`
 * path, so a future third adapter (e.g. StoreKit) costs nothing new here. */
export type EntitlementSource = 'manual' | 'play';

export interface Entitlement {
  readonly plan: 'free' | 'plus';
  readonly source: EntitlementSource;
  /** Absent means "open-ended" — used by manual grants that aren't tied to
   * a subscription period. A Play-sourced entitlement always sets this. */
  readonly expiresAt?: string;
  readonly productId?: string;
  readonly purchaseToken?: string;
  readonly verifiedAt: string;
}

/** Per-user, per-local-day counters (D69). `day` is the user's own
 * IANA-timezone calendar day (`YYYY-MM-DD`), not a UTC day — comparing it
 * against "today" computed in that same timezone is what makes the reset
 * fire at local midnight instead of UTC midnight. */
export interface Quota {
  readonly day: string;
  readonly cardReads: number;
  readonly readerOpens: number;
}

export const FREE_CARD_READS_PER_DAY = 50;
export const FREE_READER_OPENS_PER_DAY = 10;
