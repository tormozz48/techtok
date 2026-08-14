import { Link } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button } from 'react-native-paper';
import { useEntitlementQuery } from '@/api/useEntitlementQuery';
import { Radius, Spacing, type ThemeColors, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';

function formatResetTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Plan comparison + upgrade entry point (D69/D70/D73). No purchase flow yet
 * (phase 21) — the CTA is deliberately disabled so this screen can ship,
 * and be reached from every quota-exhaustion path, well before Play Billing
 * exists. Reachable from: settings' quota row, the feed once daily
 * card-reads run out, and the reader on a 402 (reader-opens exhausted).
 */
export default function PaywallScreen() {
  const strings = useStrings();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const entitlementQuery = useEntitlementQuery();
  const entitlement = entitlementQuery.data;

  const cardReadsLimit = entitlement?.quota.cardReadsLimit ?? 50;
  const readerOpensLimit = entitlement?.quota.readerOpensLimit ?? 10;
  const isExhausted =
    entitlement?.plan === 'free' &&
    (entitlement.quota.cardReads >= entitlement.quota.cardReadsLimit ||
      entitlement.quota.readerOpens >= entitlement.quota.readerOpensLimit);

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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: Spacing.four,
    },
    spinner: {
      marginBottom: Spacing.three,
    },
    exhaustedBanner: {
      backgroundColor: colors.backgroundElement,
      borderRadius: Radius.md,
      padding: Spacing.three,
      marginBottom: Spacing.four,
    },
    exhaustedTitle: {
      color: colors.text,
      ...Typography.md,
      fontWeight: '700',
      marginBottom: Spacing.one,
    },
    exhaustedMessage: {
      color: colors.textSecondary,
      ...Typography.base,
    },
    title: {
      color: colors.text,
      ...Typography.xl,
      fontWeight: '700',
      marginBottom: Spacing.two,
    },
    subtitle: {
      color: colors.textSecondary,
      ...Typography.base,
      marginBottom: Spacing.four,
    },
    plans: {
      flexDirection: 'row',
      gap: Spacing.three,
      marginBottom: Spacing.four,
    },
    planCard: {
      flex: 1,
      backgroundColor: colors.backgroundElement,
      borderRadius: Radius.md,
      padding: Spacing.three,
    },
    planCardHighlighted: {
      backgroundColor: colors.backgroundSelected,
    },
    planTitle: {
      color: colors.text,
      ...Typography.md,
      fontWeight: '700',
      marginBottom: Spacing.two,
    },
    planPrice: {
      color: colors.text,
      ...Typography.lg,
      fontWeight: '700',
    },
    planPriceSecondary: {
      color: colors.textSecondary,
      ...Typography.base,
      marginBottom: Spacing.two,
    },
    planFeature: {
      color: colors.textSecondary,
      ...Typography.base,
      marginTop: Spacing.one,
    },
    cta: {
      borderRadius: Radius.md,
    },
    settingsLink: {
      marginTop: Spacing.four,
      alignSelf: 'center',
    },
    settingsLinkText: {
      color: colors.textSecondary,
      ...Typography.base,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
  });
}
