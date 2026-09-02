import { StyleSheet } from 'react-native';
import { Spacing, type ThemeColors } from '@/constants/theme';

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: Spacing.four,
      paddingBottom: Spacing.six,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.two,
    },
    sectionTitleSpaced: {
      marginTop: Spacing.four,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: Spacing.three,
      marginBottom: Spacing.three,
    },
    row: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      marginBottom: Spacing.two,
    },
    rowSelected: {
      backgroundColor: colors.backgroundSelected,
    },
    rowText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    rowDescription: {
      color: colors.textSecondary,
      fontSize: 13,
    },
  });
}
