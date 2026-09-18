import { z } from 'zod';

export const SUBSCRIPTION_STATE_ACTIVE = 'SUBSCRIPTION_STATE_ACTIVE';

export const SUBSCRIPTION_STATE_IN_GRACE_PERIOD = 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';

export const SUBSCRIPTION_STATE_CANCELED = 'SUBSCRIPTION_STATE_CANCELED';

export const ACCESS_GRANTING_SUBSCRIPTION_STATES: readonly string[] = [
  SUBSCRIPTION_STATE_ACTIVE,
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD,
  SUBSCRIPTION_STATE_CANCELED,
];

export const playSubscriptionPurchaseSchema = z.object({
  subscriptionState: z.string().optional(),
  linkedPurchaseToken: z.string().optional(),
  testPurchase: z.object({}).loose().optional(),
  externalAccountIdentifiers: z
    .object({
      obfuscatedExternalAccountId: z.string().optional(),
      obfuscatedExternalProfileId: z.string().optional(),
    })
    .optional(),
  lineItems: z
    .array(
      z.object({
        productId: z.string().optional(),
        expiryTime: z.string().optional(),
        autoRenewingPlan: z.object({ autoRenewEnabled: z.boolean().optional() }).loose().optional(),
        offerDetails: z
          .object({
            basePlanId: z.string().optional(),
            offerId: z.string().optional(),
          })
          .loose()
          .optional(),
      }),
    )
    .optional(),
});
export type PlaySubscriptionPurchase = z.infer<typeof playSubscriptionPurchaseSchema>;

export type PlayPurchaseLookup =
  | { readonly found: true; readonly purchase: PlaySubscriptionPurchase }
  | { readonly found: false };

export type PlayNotEntitledReason =
  | 'unknown_product'
  | 'inactive_state'
  | 'missing_expiry'
  | 'expired'
  | 'account_mismatch';

export type PlayVerification =
  | {
      readonly entitled: true;
      readonly productId: string;
      readonly expiresAt: string;
      readonly basePlanId?: string;
      readonly autoRenewing: boolean;
      readonly isTestPurchase: boolean;
    }
  | { readonly entitled: false; readonly reason: PlayNotEntitledReason };

export interface VerifyPlayPurchaseOptions {
  readonly expectedProductId: string;
  readonly expectedObfuscatedAccountId?: string;
  readonly now?: Date;
}

export interface PlayApiClient {
  getSubscriptionPurchase(purchaseToken: string): Promise<PlayPurchaseLookup>;
}
