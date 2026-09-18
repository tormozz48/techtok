export interface SubscriptionOfferLike {
  readonly id?: string | null;
  readonly basePlanIdAndroid?: string | null;
  readonly offerTokenAndroid?: string | null;
  readonly displayPrice?: string | null;
  readonly price?: number | null;
}

export interface SelectedOffer {
  readonly basePlanId: string;
  readonly offerToken: string;
  readonly displayPrice?: string;
}

export function selectSubscriptionOffer(
  offers: readonly SubscriptionOfferLike[] | null | undefined,
  basePlanId: string,
): SelectedOffer | undefined {
  const candidates = (offers ?? []).filter(
    (offer) => offer.basePlanIdAndroid === basePlanId && Boolean(offer.offerTokenAndroid),
  );
  if (candidates.length === 0) return undefined;

  const basePlanOffer = candidates.find((offer) => !offer.id);
  const chosen = basePlanOffer ?? candidates[0];
  if (!chosen?.offerTokenAndroid) return undefined;

  return {
    basePlanId,
    offerToken: chosen.offerTokenAndroid,
    displayPrice: chosen.displayPrice ?? undefined,
  };
}
