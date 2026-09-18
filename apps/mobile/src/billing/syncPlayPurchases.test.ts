import type { EntitlementResponse } from '@techtok/shared';
import { PLUS_SUBSCRIPTION_PRODUCT_ID } from '@techtok/shared';
import { describe, expect, it, vi } from 'vitest';
import { type OwnedPurchaseLike, syncPlayPurchases } from './syncPlayPurchases';

function entitlement(plan: 'free' | 'plus'): EntitlementResponse {
  return {
    plan,
    quota: {
      cardReads: 0,
      cardReadsLimit: 30,
      readerOpens: 0,
      readerOpensLimit: 10,
      resetsAt: '2026-09-19T00:00:00.000Z',
    },
  };
}

const PLUS_PURCHASE: OwnedPurchaseLike = {
  productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
  purchaseToken: 'token-abc',
};

describe('syncPlayPurchases', () => {
  it('verifies an owned plus purchase and returns the entitlement', async () => {
    const verify = vi.fn(async () => entitlement('plus'));

    const result = await syncPlayPurchases({
      getOwnedPurchases: async () => [PLUS_PURCHASE],
      verify,
    });

    expect(result).toEqual({ kind: 'verified', entitlement: entitlement('plus') });
    expect(verify).toHaveBeenCalledWith({
      purchaseToken: 'token-abc',
      productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
    });
  });

  it('reports nothing to verify when Play returns no purchases', async () => {
    const verify = vi.fn(async () => entitlement('plus'));

    const result = await syncPlayPurchases({ getOwnedPurchases: async () => [], verify });

    expect(result).toEqual({ kind: 'nothing-to-verify' });
    expect(verify).not.toHaveBeenCalled();
  });

  it('ignores purchases for other products', async () => {
    const verify = vi.fn(async () => entitlement('plus'));

    const result = await syncPlayPurchases({
      getOwnedPurchases: async () => [{ productId: 'something_else', purchaseToken: 't' }],
      verify,
    });

    expect(result).toEqual({ kind: 'nothing-to-verify' });
    expect(verify).not.toHaveBeenCalled();
  });

  it('skips a suspended subscription rather than granting on it', async () => {
    const verify = vi.fn(async () => entitlement('plus'));

    const result = await syncPlayPurchases({
      getOwnedPurchases: async () => [{ ...PLUS_PURCHASE, isSuspendedAndroid: true }],
      verify,
    });

    expect(result).toEqual({ kind: 'nothing-to-verify' });
    expect(verify).not.toHaveBeenCalled();
  });

  it('surfaces a free verdict as verified, not as a failure', async () => {
    const result = await syncPlayPurchases({
      getOwnedPurchases: async () => [PLUS_PURCHASE],
      verify: async () => entitlement('free'),
    });

    expect(result).toEqual({ kind: 'verified', entitlement: entitlement('free') });
  });

  it('reports failed only when every verify threw', async () => {
    const onError = vi.fn();

    const result = await syncPlayPurchases({
      getOwnedPurchases: async () => [PLUS_PURCHASE],
      verify: async () => {
        throw new Error('network down');
      },
      onError,
    });

    expect(result).toEqual({ kind: 'failed' });
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'token-abc');
  });

  it('stops at the first plus purchase instead of verifying the rest', async () => {
    const verify = vi.fn(async () => entitlement('plus'));

    await syncPlayPurchases({
      getOwnedPurchases: async () => [
        PLUS_PURCHASE,
        { productId: PLUS_SUBSCRIPTION_PRODUCT_ID, purchaseToken: 'token-two' },
      ],
      verify,
    });

    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('keeps trying after a rejected token and returns a later plus verdict', async () => {
    const verify = vi
      .fn<(r: { purchaseToken: string; productId: string }) => Promise<EntitlementResponse>>()
      .mockRejectedValueOnce(new Error('invalid_purchase_token'))
      .mockResolvedValueOnce(entitlement('plus'));

    const result = await syncPlayPurchases({
      getOwnedPurchases: async () => [
        PLUS_PURCHASE,
        { productId: PLUS_SUBSCRIPTION_PRODUCT_ID, purchaseToken: 'token-two' },
      ],
      verify,
    });

    expect(result).toMatchObject({ kind: 'verified' });
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('de-duplicates a token Play reports twice', async () => {
    const verify = vi.fn(async () => entitlement('free'));

    await syncPlayPurchases({
      getOwnedPurchases: async () => [PLUS_PURCHASE, PLUS_PURCHASE],
      verify,
    });

    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('ignores a purchase with no token at all', async () => {
    const verify = vi.fn(async () => entitlement('plus'));

    const result = await syncPlayPurchases({
      getOwnedPurchases: async () => [{ productId: PLUS_SUBSCRIPTION_PRODUCT_ID }],
      verify,
    });

    expect(result).toEqual({ kind: 'nothing-to-verify' });
    expect(verify).not.toHaveBeenCalled();
  });
});
