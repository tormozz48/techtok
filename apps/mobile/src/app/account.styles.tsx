import { StyleSheet } from 'react-native';
import { Spacing, type ThemeColors, Typography } from '@/constants/theme';

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: Spacing.four,
    },
    email: {
      color: colors.textSecondary,
      ...Typography.base,
      marginBottom: Spacing.four,
    },
    button: {
      marginBottom: Spacing.three,
    },
    error: {
      color: colors.error,
      ...Typography.base,
      marginTop: Spacing.two,
    },
  });
}
