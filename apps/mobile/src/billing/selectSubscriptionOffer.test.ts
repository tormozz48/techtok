import { PLUS_MONTHLY_BASE_PLAN_ID, PLUS_YEARLY_BASE_PLAN_ID } from '@techtok/shared';
import { describe, expect, it } from 'vitest';
import { type SubscriptionOfferLike, selectSubscriptionOffer } from './selectSubscriptionOffer';

const MONTHLY: SubscriptionOfferLike = {
  id: '',
  basePlanIdAndroid: PLUS_MONTHLY_BASE_PLAN_ID,
  offerTokenAndroid: 'token-monthly',
  displayPrice: '€2.99',
  price: 2.99,
};

const YEARLY: SubscriptionOfferLike = {
  id: '',
  basePlanIdAndroid: PLUS_YEARLY_BASE_PLAN_ID,
  offerTokenAndroid: 'token-yearly',
  displayPrice: '€24.99',
  price: 24.99,
};

describe('selectSubscriptionOffer', () => {
  it('picks the offer for the requested base plan', () => {
    expect(selectSubscriptionOffer([MONTHLY, YEARLY], PLUS_YEARLY_BASE_PLAN_ID)).toEqual({
      basePlanId: PLUS_YEARLY_BASE_PLAN_ID,
      offerToken: 'token-yearly',
      displayPrice: '€24.99',
    });
  });

  it('prefers the plain base-plan offer over a promotional one', () => {
    const promo: SubscriptionOfferLike = {
      id: 'launch-promo',
      basePlanIdAndroid: PLUS_MONTHLY_BASE_PLAN_ID,
      offerTokenAndroid: 'token-promo',
      displayPrice: '€0.99',
      price: 0.99,
    };

    expect(selectSubscriptionOffer([promo, MONTHLY], PLUS_MONTHLY_BASE_PLAN_ID)?.offerToken).toBe(
      'token-monthly',
    );
  });

  it('falls back to a promotional offer when the base plan has no plain offer', () => {
    const promo: SubscriptionOfferLike = {
      id: 'launch-promo',
      basePlanIdAndroid: PLUS_MONTHLY_BASE_PLAN_ID,
      offerTokenAndroid: 'token-promo',
    };

    expect(selectSubscriptionOffer([promo], PLUS_MONTHLY_BASE_PLAN_ID)?.offerToken).toBe(
      'token-promo',
    );
  });

  it('returns undefined when no offer matches the base plan', () => {
    expect(selectSubscriptionOffer([MONTHLY], PLUS_YEARLY_BASE_PLAN_ID)).toBeUndefined();
  });

  it('ignores an offer that carries no purchase token', () => {
    const tokenless: SubscriptionOfferLike = {
      id: '',
      basePlanIdAndroid: PLUS_MONTHLY_BASE_PLAN_ID,
      offerTokenAndroid: null,
    };

    expect(selectSubscriptionOffer([tokenless], PLUS_MONTHLY_BASE_PLAN_ID)).toBeUndefined();
  });

  it('survives an empty or absent offer list', () => {
    expect(selectSubscriptionOffer([], PLUS_MONTHLY_BASE_PLAN_ID)).toBeUndefined();
    expect(selectSubscriptionOffer(undefined, PLUS_MONTHLY_BASE_PLAN_ID)).toBeUndefined();
    expect(selectSubscriptionOffer(null, PLUS_MONTHLY_BASE_PLAN_ID)).toBeUndefined();
  });

  it('omits displayPrice rather than inventing one', () => {
    const priceless: SubscriptionOfferLike = {
      id: '',
      basePlanIdAndroid: PLUS_MONTHLY_BASE_PLAN_ID,
      offerTokenAndroid: 'token-monthly',
    };

    expect(selectSubscriptionOffer([priceless], PLUS_MONTHLY_BASE_PLAN_ID)).toEqual({
      basePlanId: PLUS_MONTHLY_BASE_PLAN_ID,
      offerToken: 'token-monthly',
      displayPrice: undefined,
    });
  });
});
