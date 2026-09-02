import { StyleSheet } from 'react-native';
import { Radius, Spacing, type ThemeColors, Typography } from '@/constants/theme';

export function createStyles(colors: ThemeColors) {
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
