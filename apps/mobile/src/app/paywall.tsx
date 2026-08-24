import { useQueryClient } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ActivityIndicator, Button } from 'react-native-paper';
import { useEntitlementQuery } from '@/api/useEntitlementQuery';
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
  const entitlement = entitlementQuery.data;

  const cardReadsLimit = entitlement?.quota.cardReadsLimit ?? 100;
  const readerOpensLimit = entitlement?.quota.readerOpensLimit ?? 20;
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
          <Text style={styles.planPrice}>{strings.paywall.plusPlanPriceMonthly}</Text>
          <Text style={styles.planPriceSecondary}>{strings.paywall.plusPlanPriceYearly}</Text>
          <Text style={styles.planFeature}>{strings.paywall.plusPlanFeatureUnlimited}</Text>
        </View>
      </View>

      <Button mode="contained" disabled style={styles.cta}>
        {strings.paywall.comingSoonCta}
      </Button>

      <Link href="/settings" style={styles.settingsLink}>
        <Text style={styles.settingsLinkText}>{strings.settings.title}</Text>
      </Link>
    </ScrollView>
  );
}
