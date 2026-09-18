import { PLUS_MONTHLY_BASE_PLAN_ID, PLUS_SUBSCRIPTION_PRODUCT_ID } from '@techtok/shared';
import type { PlayNotEntitledReason } from '../playBilling.types';

export interface PlayPurchaseFixture {
  readonly name: string;
  readonly response: Record<string, unknown>;
  readonly expectedEntitled: boolean;
  readonly expectedReason?: PlayNotEntitledReason;
  readonly expectedExpiresAt?: string;
}

export const FIXTURE_NOW = new Date('2026-09-18T12:00:00.000Z');

export const PLAY_PURCHASE_FIXTURES: PlayPurchaseFixture[] = [
  {
    name: 'active monthly subscription',
    response: {
      kind: 'androidpublisher#subscriptionPurchaseV2',
      regionCode: 'PL',
      startTime: '2026-09-01T09:14:22.117Z',
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      latestOrderId: 'GPA.3312-8871-0043-11221',
      acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
      lineItems: [
        {
          productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
          expiryTime: '2026-10-01T09:14:20.000Z',
          autoRenewingPlan: {
            autoRenewEnabled: true,
            recurringPrice: { currencyCode: 'EUR', units: '2', nanos: 990000000 },
          },
          offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID, offerTags: [] },
        },
      ],
    },
    expectedEntitled: true,
    expectedExpiresAt: '2026-10-01T09:14:20.000Z',
  },
  {
    name: 'canceled but still inside the paid period',
    response: {
      subscriptionState: 'SUBSCRIPTION_STATE_CANCELED',
      canceledStateContext: {
        userInitiatedCancellation: { cancelTime: '2026-09-17T18:02:11.000Z' },
      },
      lineItems: [
        {
          productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
          expiryTime: '2026-10-01T09:14:20.000Z',
          autoRenewingPlan: { autoRenewEnabled: false },
          offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID },
        },
      ],
    },
    expectedEntitled: true,
    expectedExpiresAt: '2026-10-01T09:14:20.000Z',
  },
  {
    name: 'in grace period after a failed payment',
    response: {
      subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
      inGracePeriodStateContext: {},
      lineItems: [
        {
          productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
          expiryTime: '2026-09-25T09:14:20.000Z',
          autoRenewingPlan: { autoRenewEnabled: true },
          offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID },
        },
      ],
    },
    expectedEntitled: true,
    expectedExpiresAt: '2026-09-25T09:14:20.000Z',
  },
  {
    name: 'license tester purchase',
    response: {
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      testPurchase: {},
      lineItems: [
        {
          productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
          expiryTime: '2026-09-18T12:05:00.000Z',
          autoRenewingPlan: { autoRenewEnabled: true },
          offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID },
        },
      ],
    },
    expectedEntitled: true,
    expectedExpiresAt: '2026-09-18T12:05:00.000Z',
  },
  {
    name: 'expired subscription',
    response: {
      subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED',
      lineItems: [
        {
          productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
          expiryTime: '2026-09-01T09:14:20.000Z',
          offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID },
        },
      ],
    },
    expectedEntitled: false,
    expectedReason: 'inactive_state',
  },
  {
    name: 'account hold after repeated payment failure',
    response: {
      subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD',
      onHoldStateContext: {},
      lineItems: [
        {
          productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
          expiryTime: '2026-10-01T09:14:20.000Z',
          offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID },
        },
      ],
    },
    expectedEntitled: false,
    expectedReason: 'inactive_state',
  },
  {
    name: 'paused subscription',
    response: {
      subscriptionState: 'SUBSCRIPTION_STATE_PAUSED',
      pausedStateContext: { autoResumeTime: '2026-11-01T09:14:20.000Z' },
      lineItems: [
        {
          productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
          expiryTime: '2026-10-01T09:14:20.000Z',
          offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID },
        },
      ],
    },
    expectedEntitled: false,
    expectedReason: 'inactive_state',
  },
  {
    name: 'pending purchase awaiting payment',
    response: {
      subscriptionState: 'SUBSCRIPTION_STATE_PENDING',
      lineItems: [
        {
          productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
          expiryTime: '2026-10-01T09:14:20.000Z',
          offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID },
        },
      ],
    },
    expectedEntitled: false,
    expectedReason: 'inactive_state',
  },
  {
    name: 'active state whose period has nevertheless elapsed',
    response: {
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [
        {
          productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
          expiryTime: '2026-09-18T11:59:59.000Z',
          offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID },
        },
      ],
    },
    expectedEntitled: false,
    expectedReason: 'expired',
  },
  {
    name: 'subscription for a product we do not sell',
    response: {
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [
        {
          productId: 'some_other_app_product',
          expiryTime: '2026-10-01T09:14:20.000Z',
          offerDetails: { basePlanId: 'whatever' },
        },
      ],
    },
    expectedEntitled: false,
    expectedReason: 'unknown_product',
  },
  {
    name: 'unrecognized future subscription state',
    response: {
      subscriptionState: 'SUBSCRIPTION_STATE_SOMETHING_GOOGLE_ADDED_LATER',
      lineItems: [
        {
          productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
          expiryTime: '2026-10-01T09:14:20.000Z',
          offerDetails: { basePlanId: PLUS_MONTHLY_BASE_PLAN_ID },
        },
      ],
    },
    expectedEntitled: false,
    expectedReason: 'inactive_state',
  },
];
