import { PLUS_MONTHLY_BASE_PLAN_ID, PLUS_SUBSCRIPTION_PRODUCT_ID } from '@techtok/shared';
import { describe, expect, it } from 'vitest';
import { FIXTURE_NOW, PLAY_PURCHASE_FIXTURES } from './__fixtures__/playPurchaseFixtures';
import { obfuscatedAccountId } from './obfuscatedAccountId';
import { playSubscriptionPurchaseSchema } from './playBilling.types';
import { verifyPlayPurchase } from './verifyPlayPurchase';

const ACTIVE_PURCHASE = {
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  lineItems: [
    {
      productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
      expiryTime: '2026-10-01T09:14:20.000Z',
      autoRenewingPlan: { autoRenewEnabled: true },
      offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID },
    },
  ],
};

describe('verifyPlayPurchase golden fixtures', () => {
  it.each(PLAY_PURCHASE_FIXTURES)(
    '$name resolves as expected',
    ({ response, expectedEntitled, expectedReason, expectedExpiresAt }) => {
      const purchase = playSubscriptionPurchaseSchema.parse(response);

      const result = verifyPlayPurchase(purchase, {
        expectedProductId: PLUS_SUBSCRIPTION_PRODUCT_ID,
        now: FIXTURE_NOW,
      });

      expect(result.entitled).toBe(expectedEntitled);
      if (result.entitled) {
        expect(result.expiresAt).toBe(expectedExpiresAt);
      } else {
        expect(result.reason).toBe(expectedReason);
      }
    },
  );
});

describe('verifyPlayPurchase', () => {
  it('carries the base plan through so monthly and yearly are distinguishable', () => {
    const purchase = playSubscriptionPurchaseSchema.parse(ACTIVE_PURCHASE);

    const result = verifyPlayPurchase(purchase, {
      expectedProductId: PLUS_SUBSCRIPTION_PRODUCT_ID,
      now: FIXTURE_NOW,
    });

    expect(result).toMatchObject({
      entitled: true,
      basePlanId: PLUS_MONTHLY_BASE_PLAN_ID,
      autoRenewing: true,
    });
  });

  it('rejects a purchase carrying another account identifier', () => {
    const purchase = playSubscriptionPurchaseSchema.parse({
      ...ACTIVE_PURCHASE,
      externalAccountIdentifiers: {
        obfuscatedExternalAccountId: obfuscatedAccountId('g:someone-else'),
      },
    });

    const result = verifyPlayPurchase(purchase, {
      expectedProductId: PLUS_SUBSCRIPTION_PRODUCT_ID,
      expectedObfuscatedAccountId: obfuscatedAccountId('g:me'),
      now: FIXTURE_NOW,
    });

    expect(result).toEqual({ entitled: false, reason: 'account_mismatch' });
  });

  it('accepts a purchase whose account identifier matches the caller', () => {
    const purchase = playSubscriptionPurchaseSchema.parse({
      ...ACTIVE_PURCHASE,
      externalAccountIdentifiers: {
        obfuscatedExternalAccountId: obfuscatedAccountId('g:me'),
      },
    });

    const result = verifyPlayPurchase(purchase, {
      expectedProductId: PLUS_SUBSCRIPTION_PRODUCT_ID,
      expectedObfuscatedAccountId: obfuscatedAccountId('g:me'),
      now: FIXTURE_NOW,
    });

    expect(result.entitled).toBe(true);
  });

  it('accepts a purchase made before the app started tagging accounts', () => {
    const purchase = playSubscriptionPurchaseSchema.parse(ACTIVE_PURCHASE);

    const result = verifyPlayPurchase(purchase, {
      expectedProductId: PLUS_SUBSCRIPTION_PRODUCT_ID,
      expectedObfuscatedAccountId: obfuscatedAccountId('g:me'),
      now: FIXTURE_NOW,
    });

    expect(result.entitled).toBe(true);
  });

  it('treats a missing expiry as not entitled rather than granting forever', () => {
    const purchase = playSubscriptionPurchaseSchema.parse({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{ productId: PLUS_SUBSCRIPTION_PRODUCT_ID }],
    });

    const result = verifyPlayPurchase(purchase, {
      expectedProductId: PLUS_SUBSCRIPTION_PRODUCT_ID,
      now: FIXTURE_NOW,
    });

    expect(result).toEqual({ entitled: false, reason: 'missing_expiry' });
  });

  it('treats an unparseable expiry as not entitled', () => {
    const purchase = playSubscriptionPurchaseSchema.parse({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{ productId: PLUS_SUBSCRIPTION_PRODUCT_ID, expiryTime: 'not-a-timestamp' }],
    });

    const result = verifyPlayPurchase(purchase, {
      expectedProductId: PLUS_SUBSCRIPTION_PRODUCT_ID,
      now: FIXTURE_NOW,
    });

    expect(result).toEqual({ entitled: false, reason: 'missing_expiry' });
  });

  it('treats an empty line item list as an unknown product', () => {
    const purchase = playSubscriptionPurchaseSchema.parse({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    });

    const result = verifyPlayPurchase(purchase, {
      expectedProductId: PLUS_SUBSCRIPTION_PRODUCT_ID,
      now: FIXTURE_NOW,
    });

    expect(result).toEqual({ entitled: false, reason: 'unknown_product' });
  });

  it('picks our line item out of a multi-product subscription', () => {
    const purchase = playSubscriptionPurchaseSchema.parse({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [
        { productId: 'other_product', expiryTime: '2027-01-01T00:00:00.000Z' },
        {
          productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
          expiryTime: '2026-10-01T09:14:20.000Z',
          offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID },
        },
      ],
    });

    const result = verifyPlayPurchase(purchase, {
      expectedProductId: PLUS_SUBSCRIPTION_PRODUCT_ID,
      now: FIXTURE_NOW,
    });

    expect(result).toMatchObject({ entitled: true, expiresAt: '2026-10-01T09:14:20.000Z' });
  });
});

describe('obfuscatedAccountId', () => {
  it('is deterministic and fits Play’s 64-character ceiling', () => {
    const id = obfuscatedAccountId('g:104512338877120044321');

    expect(id).toBe(obfuscatedAccountId('g:104512338877120044321'));
    expect(id).toHaveLength(64);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not leak the user id it was derived from', () => {
    expect(obfuscatedAccountId('g:104512338877120044321')).not.toContain('104512338877120044321');
  });

  it('separates two users', () => {
    expect(obfuscatedAccountId('g:a')).not.toBe(obfuscatedAccountId('g:b'));
  });
});
