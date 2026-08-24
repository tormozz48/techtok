import { StyleSheet } from 'react-native';
import { Spacing, type ThemeColors } from '@/constants/theme';

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchbar: {
      margin: Spacing.three,
      backgroundColor: colors.backgroundElement,
    },
    list: {
      flex: 1,
      backgroundColor: colors.background,
    },
    row: {
      borderBottomColor: colors.backgroundElement,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.three,
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: Spacing.one,
    },
    metaText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
