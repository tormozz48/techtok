import { PLUS_MONTHLY_BASE_PLAN_ID, PLUS_SUBSCRIPTION_PRODUCT_ID } from '@techtok/shared';
import { describe, expect, it } from 'vitest';
import type { Entitlement } from '../entitlement/entitlement.types';
import { isPlus } from '../entitlement/isPlus';
import { FIXTURE_NOW } from './__fixtures__/playPurchaseFixtures';
import { obfuscatedAccountId } from './obfuscatedAccountId';
import { type PlayPurchaseLookup, playSubscriptionPurchaseSchema } from './playBilling.types';
import {
  type ResolvePlayVerificationInput,
  resolvePlayVerification,
} from './resolvePlayVerification';

const USER_ID = 'g:104512338877120044321';

const OTHER_USER_ID = 'g:999999999999999999999';

const PURCHASE_TOKEN = 'play-token-abc';

const VERIFIED_AT = '2026-09-18T12:00:00.000Z';

const EXPIRY = '2026-10-01T09:14:20.000Z';

function lookupFound(overrides: Record<string, unknown> = {}): PlayPurchaseLookup {
  return {
    found: true,
    purchase: playSubscriptionPurchaseSchema.parse({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [
        {
          productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
          expiryTime: EXPIRY,
          autoRenewingPlan: { autoRenewEnabled: true },
          offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID },
        },
      ],
      ...overrides,
    }),
  };
}

function resolve(overrides: Partial<ResolvePlayVerificationInput> = {}) {
  return resolvePlayVerification({
    userId: USER_ID,
    purchaseToken: PURCHASE_TOKEN,
    expectedProductId: PLUS_SUBSCRIPTION_PRODUCT_ID,
    lookup: lookupFound(),
    verifiedAt: VERIFIED_AT,
    now: FIXTURE_NOW,
    ...overrides,
  });
}

const ACTIVE_PLAY_ENTITLEMENT: Entitlement = {
  plan: 'plus',
  source: 'play',
  expiresAt: EXPIRY,
  productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
  purchaseToken: PURCHASE_TOKEN,
  verifiedAt: '2026-09-17T08:00:00.000Z',
};

describe('resolvePlayVerification granting', () => {
  it('grants plus for an active subscription, carrying Play’s expiry', () => {
    expect(resolve()).toEqual({
      kind: 'grant',
      entitlement: {
        plan: 'plus',
        source: 'play',
        expiresAt: EXPIRY,
        productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
        purchaseToken: PURCHASE_TOKEN,
        verifiedAt: VERIFIED_AT,
      },
    });
  });

  it('produces an entitlement that isPlus actually accepts', () => {
    const outcome = resolve();

    expect(outcome.kind).toBe('grant');
    if (outcome.kind !== 'grant') return;
    expect(isPlus({ entitlement: outcome.entitlement }, FIXTURE_NOW)).toBe(true);
  });

  it('re-grants identically when the same token is verified again', () => {
    const first = resolve();
    const second = resolve({ currentEntitlement: ACTIVE_PLAY_ENTITLEMENT });

    expect(second).toEqual(first);
  });

  it('lets a Play purchase take over from a manual grant', () => {
    const outcome = resolve({
      currentEntitlement: {
        plan: 'plus',
        source: 'manual',
        verifiedAt: '2026-08-01T00:00:00.000Z',
      },
    });

    expect(outcome).toMatchObject({ kind: 'grant', entitlement: { source: 'play' } });
  });

  it('accepts the token when it is already bound to this same user', () => {
    expect(resolve({ tokenOwnerUserId: USER_ID })).toMatchObject({ kind: 'grant' });
  });
});

describe('resolvePlayVerification rejection', () => {
  it('rejects a token Google does not recognize', () => {
    expect(resolve({ lookup: { found: false } })).toEqual({
      kind: 'rejected',
      reason: 'invalid_purchase_token',
    });
  });

  it('rejects a token already bound to a different user', () => {
    expect(resolve({ tokenOwnerUserId: OTHER_USER_ID })).toEqual({
      kind: 'rejected',
      reason: 'purchase_token_claimed',
    });
  });

  it('rejects a replay before it even reaches Google', () => {
    const outcome = resolve({
      tokenOwnerUserId: OTHER_USER_ID,
      lookup: { found: false },
    });

    expect(outcome).toEqual({ kind: 'rejected', reason: 'purchase_token_claimed' });
  });

  it('rejects a purchase Play attributes to another account', () => {
    const outcome = resolve({
      lookup: lookupFound({
        externalAccountIdentifiers: {
          obfuscatedExternalAccountId: obfuscatedAccountId(OTHER_USER_ID),
        },
      }),
    });

    expect(outcome).toEqual({ kind: 'rejected', reason: 'purchase_token_claimed' });
  });

  it('accepts a purchase Play attributes to this account', () => {
    const outcome = resolve({
      lookup: lookupFound({
        externalAccountIdentifiers: {
          obfuscatedExternalAccountId: obfuscatedAccountId(USER_ID),
        },
      }),
    });

    expect(outcome).toMatchObject({ kind: 'grant' });
  });

  it('never downgrades a user it just rejected', () => {
    const outcome = resolve({
      tokenOwnerUserId: OTHER_USER_ID,
      currentEntitlement: ACTIVE_PLAY_ENTITLEMENT,
    });

    expect(outcome.kind).toBe('rejected');
  });
});

describe('resolvePlayVerification reconciliation', () => {
  it('revokes when the token that currently grants access has lapsed', () => {
    const outcome = resolve({
      lookup: lookupFound({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' }),
      currentEntitlement: ACTIVE_PLAY_ENTITLEMENT,
    });

    expect(outcome).toEqual({
      kind: 'revoke',
      entitlement: {
        plan: 'free',
        source: 'play',
        productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
        purchaseToken: PURCHASE_TOKEN,
        verifiedAt: VERIFIED_AT,
      },
    });
  });

  it('produces a revocation that isPlus rejects', () => {
    const outcome = resolve({
      lookup: lookupFound({ subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD' }),
      currentEntitlement: ACTIVE_PLAY_ENTITLEMENT,
    });

    expect(outcome.kind).toBe('revoke');
    if (outcome.kind !== 'revoke') return;
    expect(isPlus({ entitlement: outcome.entitlement }, FIXTURE_NOW)).toBe(false);
  });

  it('leaves a manual grant alone when an unrelated Play token has lapsed', () => {
    const outcome = resolve({
      lookup: lookupFound({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' }),
      currentEntitlement: {
        plan: 'plus',
        source: 'manual',
        verifiedAt: '2026-08-01T00:00:00.000Z',
      },
    });

    expect(outcome).toEqual({ kind: 'unchanged' });
  });

  it('leaves a live subscription alone when an older token has lapsed', () => {
    const outcome = resolve({
      purchaseToken: 'superseded-token',
      lookup: lookupFound({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' }),
      currentEntitlement: ACTIVE_PLAY_ENTITLEMENT,
    });

    expect(outcome).toEqual({ kind: 'unchanged' });
  });

  it('reports unchanged for a lapsed token on a user who has nothing', () => {
    const outcome = resolve({
      lookup: lookupFound({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' }),
    });

    expect(outcome).toEqual({ kind: 'unchanged' });
  });

  it('reports unchanged when a lapsed token matches an already-free entitlement', () => {
    const outcome = resolve({
      lookup: lookupFound({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' }),
      currentEntitlement: { ...ACTIVE_PLAY_ENTITLEMENT, plan: 'free' },
    });

    expect(outcome).toEqual({ kind: 'unchanged' });
  });

  it('revokes when the granting token stops resolving to our product', () => {
    const outcome = resolve({
      lookup: lookupFound({
        lineItems: [{ productId: 'other_app_product', expiryTime: EXPIRY }],
      }),
      currentEntitlement: ACTIVE_PLAY_ENTITLEMENT,
    });

    expect(outcome).toMatchObject({ kind: 'revoke' });
  });
});
