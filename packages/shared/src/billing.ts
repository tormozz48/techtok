export const PLUS_SUBSCRIPTION_PRODUCT_ID = 'techtok_plus';

export const PLUS_MONTHLY_BASE_PLAN_ID = 'plus-monthly';

export const PLUS_YEARLY_BASE_PLAN_ID = 'plus-yearly';

export const PLUS_BASE_PLAN_IDS = [PLUS_MONTHLY_BASE_PLAN_ID, PLUS_YEARLY_BASE_PLAN_ID] as const;

export type PlusBasePlanId = (typeof PLUS_BASE_PLAN_IDS)[number];

export const FREE_CARD_READS_PER_DAY = 30;

export const FREE_READER_OPENS_PER_DAY = 10;
