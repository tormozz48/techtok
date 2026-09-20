import { useQueryClient } from '@tanstack/react-query';
import {
  FREE_CARD_READS_PER_DAY,
  FREE_READER_OPENS_PER_DAY,
  PLUS_MONTHLY_BASE_PLAN_ID,
  PLUS_YEARLY_BASE_PLAN_ID,
} from '@techtok/shared';
import { Link, router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ActivityIndicator, Button } from 'react-native-paper';
import { useEntitlementQuery } from '@/api/useEntitlementQuery';
import { usePlayBilling } from '@/billing/usePlayBilling';
import { useQuotaReset } from '@/hooks/useQuotaReset';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { formatResetTime } from '@/utils/formatResetTime';
import { createStyles } from './paywall.styles';

export default function PaywallScreen() {
  const strings = useStrings();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const entitlementQuery = useEntitlementQuery();
  const queryClient = useQueryClient();
  const billing = usePlayBilling();
  const entitlement = entitlementQuery.data;

  const cardReadsLimit = entitlement?.quota.cardReadsLimit ?? FREE_CARD_READS_PER_DAY;
  const readerOpensLimit = entitlement?.quota.readerOpensLimit ?? FREE_READER_OPENS_PER_DAY;
  const isPlus = entitlement?.plan === 'plus';
  const isExhausted =
    entitlement?.plan === 'free' &&
    (entitlement.quota.cardReads >= entitlement.quota.cardReadsLimit ||
      entitlement.quota.readerOpens >= entitlement.quota.readerOpensLimit);

  const wasExhausted = useRef(false);
  useEffect(() => {
    if (isExhausted) wasExhausted.current = true;
  }, [isExhausted]);

  useQuotaReset(entitlement?.quota.resetsAt, () => {
    entitlementQuery.refetch();
    if (wasExhausted.current) queryClient.resetQueries({ queryKey: ['feed'] });
  });

  useEffect(() => {
    if (!wasExhausted.current || !entitlement || isExhausted) return;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [entitlement, isExhausted]);

  const busy = billing.status === 'purchasing' || billing.status === 'verifying';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {entitlementQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : null}

      {isExhausted && entitlement ? (
        <View style={styles.exhaustedBanner}>
          <Text style={styles.exhaustedTitle}>{strings.paywall.quotaExhaustedTitle}</Text>
          <Text style={styles.exhaustedMessage}>
            {strings.paywall.quotaExhaustedMessage(formatResetTime(entitlement.quota.resetsAt))}
          </Text>
        </View>
      ) : null}

      {isPlus ? (
        <View style={styles.exhaustedBanner}>
          <Text style={styles.exhaustedTitle}>{strings.paywall.plusActiveTitle}</Text>
          {entitlement?.expiresAt ? (
            <Text style={styles.exhaustedMessage}>
              {strings.paywall.plusActiveMessage(
                new Date(entitlement.expiresAt).toLocaleDateString(),
              )}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.title}>{strings.paywall.title}</Text>
      <Text style={styles.subtitle}>{strings.paywall.subtitle}</Text>

      <View style={styles.plans}>
        <View style={styles.planCard}>
          <Text style={styles.planTitle}>{strings.paywall.freePlanTitle}</Text>
          <Text style={styles.planFeature}>
            {strings.paywall.freePlanFeatureCardReads(cardReadsLimit)}
          </Text>
          <Text style={styles.planFeature}>
            {strings.paywall.freePlanFeatureReaderOpens(readerOpensLimit)}
          </Text>
        </View>

        <View style={[styles.planCard, styles.planCardHighlighted]}>
          <Text style={styles.planTitle}>{strings.paywall.plusPlanTitle}</Text>
          <Text style={styles.planPrice}>
            {billing.monthly?.displayPrice ?? strings.paywall.plusPlanPriceMonthly}
          </Text>
          <Text style={styles.planPriceSecondary}>
            {billing.yearly?.displayPrice ?? strings.paywall.plusPlanPriceYearly}
          </Text>
          <Text style={styles.planFeature}>{strings.paywall.plusPlanFeatureUnlimited}</Text>
          <Text style={styles.planFeature}>{strings.paywall.plusPlanFeatureAllSources}</Text>
        </View>
      </View>

      {billing.status === 'error' ? (
        <Text style={styles.exhaustedMessage}>{strings.paywall.purchaseFailed}</Text>
      ) : null}

      {!billing.supported ? (
        <Text style={styles.exhaustedMessage}>{strings.paywall.billingUnavailable}</Text>
      ) : null}

      {isPlus ? (
        <Button
          mode="contained"
          style={styles.cta}
          onPress={billing.manage}
          accessibilityLabel={strings.paywall.manageCta}
        >
          {strings.paywall.manageCta}
        </Button>
      ) : (
        <>
          <Button
            mode="contained"
            style={styles.cta}
            loading={busy}
            disabled={!billing.supported || busy || !billing.monthly}
            onPress={() => billing.purchase(PLUS_MONTHLY_BASE_PLAN_ID)}
            accessibilityLabel={strings.paywall.subscribeMonthlyCta(
              billing.monthly?.displayPrice ?? strings.paywall.plusPlanPriceMonthly,
            )}
          >
            {strings.paywall.subscribeMonthlyCta(
              billing.monthly?.displayPrice ?? strings.paywall.plusPlanPriceMonthly,
            )}
          </Button>

          <Button
            mode="outlined"
            style={styles.cta}
            disabled={!billing.supported || busy || !billing.yearly}
            onPress={() => billing.purchase(PLUS_YEARLY_BASE_PLAN_ID)}
            accessibilityLabel={strings.paywall.subscribeYearlyCta(
              billing.yearly?.displayPrice ?? strings.paywall.plusPlanPriceYearly,
            )}
          >
            {strings.paywall.subscribeYearlyCta(
              billing.yearly?.displayPrice ?? strings.paywall.plusPlanPriceYearly,
            )}
          </Button>

          <Button
            mode="text"
            style={styles.cta}
            disabled={!billing.supported || busy}
            onPress={billing.restore}
            accessibilityLabel={strings.paywall.restoreCta}
          >
            {strings.paywall.restoreCta}
          </Button>
        </>
      )}

      <Link href="/settings" style={styles.settingsLink}>
        <Text style={styles.settingsLinkText}>{strings.settings.title}</Text>
      </Link>
    </ScrollView>
  );
}
