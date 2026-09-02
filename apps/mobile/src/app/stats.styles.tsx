import { StyleSheet } from 'react-native';
import { Spacing, type ThemeColors, Typography } from '@/constants/theme';

export type StatsStyles = ReturnType<typeof createStyles>;

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: Spacing.four,
    },
    tileRow: {
      flexDirection: 'row',
      gap: Spacing.two,
      marginBottom: Spacing.five,
    },
    tile: {
      flex: 1,
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      paddingVertical: Spacing.three,
      alignItems: 'center',
    },
    tileValue: {
      color: colors.text,
      ...Typography.xxl,
      fontWeight: '700',
    },
    tileLabel: {
      color: colors.textSecondary,
      ...Typography.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: Spacing.one,
      textAlign: 'center',
    },
    section: {
      marginBottom: Spacing.four,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.two,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      marginBottom: Spacing.two,
    },
    rowLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    rowCount: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
