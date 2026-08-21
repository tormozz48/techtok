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

export const FREE_CARD_READS_PER_DAY = 100;
export const FREE_READER_OPENS_PER_DAY = 20;
