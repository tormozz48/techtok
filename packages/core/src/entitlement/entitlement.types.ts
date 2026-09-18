export type EntitlementSource = 'manual' | 'play';

export interface Entitlement {
  readonly plan: 'free' | 'plus';
  readonly source: EntitlementSource;
  readonly expiresAt?: string;
  readonly productId?: string;
  readonly purchaseToken?: string;
  readonly verifiedAt: string;
}

export interface Quota {
  readonly day: string;
  readonly cardReads: number;
  readonly readerOpens: number;
}

export { FREE_CARD_READS_PER_DAY, FREE_READER_OPENS_PER_DAY } from '@techtok/shared';
