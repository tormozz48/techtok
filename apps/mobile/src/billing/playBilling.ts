import { PLUS_SUBSCRIPTION_PRODUCT_ID } from '@techtok/shared';
import Constants from 'expo-constants';
import {
  deepLinkToSubscriptions,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  type Purchase,
  requestPurchase,
} from 'expo-iap';
import { Platform } from 'react-native';
import {
  type SelectedOffer,
  type SubscriptionOfferLike,
  selectSubscriptionOffer,
} from './selectSubscriptionOffer';

export interface PlusPlanOffer extends SelectedOffer {
  readonly productId: string;
}

let connection: Promise<boolean> | null = null;

export function isPlayBillingSupported(): boolean {
  return Platform.OS === 'android';
}

export async function ensureBillingConnection(): Promise<boolean> {
  if (!isPlayBillingSupported()) return false;
  connection ??= initConnection();
  try {
    return await connection;
  } catch (error) {
    connection = null;
    throw error;
  }
}

export async function fetchPlusOffers(basePlanIds: readonly string[]): Promise<PlusPlanOffer[]> {
  await ensureBillingConnection();
  const products = await fetchProducts({ skus: [PLUS_SUBSCRIPTION_PRODUCT_ID], type: 'subs' });
  const plus = (products ?? []).find((product) => product.id === PLUS_SUBSCRIPTION_PRODUCT_ID);
  if (!plus) return [];

  const offers = (plus as { subscriptionOffers?: SubscriptionOfferLike[] | null })
    .subscriptionOffers;

  return basePlanIds.flatMap((basePlanId) => {
    const offer = selectSubscriptionOffer(offers, basePlanId);
    return offer ? [{ ...offer, productId: PLUS_SUBSCRIPTION_PRODUCT_ID }] : [];
  });
}

export async function requestPlusSubscription(
  offer: PlusPlanOffer,
  obfuscatedAccountId: string,
): Promise<void> {
  await ensureBillingConnection();
  await requestPurchase({
    type: 'subs',
    request: {
      google: {
        skus: [offer.productId],
        subscriptionOffers: [{ sku: offer.productId, offerToken: offer.offerToken }],
        obfuscatedAccountId,
      },
    },
  });
}

export async function fetchOwnedPurchases(): Promise<Purchase[]> {
  await ensureBillingConnection();
  return getAvailablePurchases();
}

export async function acknowledgePurchase(purchase: Purchase): Promise<void> {
  await finishTransaction({ purchase, isConsumable: false });
}

export async function openPlaySubscriptionSettings(): Promise<void> {
  await deepLinkToSubscriptions({
    skuAndroid: PLUS_SUBSCRIPTION_PRODUCT_ID,
    packageNameAndroid: Constants.expoConfig?.android?.package ?? undefined,
  });
}
