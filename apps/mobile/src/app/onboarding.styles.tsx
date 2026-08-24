import { StyleSheet } from 'react-native';
import { Spacing, type ThemeColors, Typography } from '@/constants/theme';

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: Spacing.four,
    },
    title: {
      color: colors.text,
      ...Typography.xl,
      fontWeight: '700',
      marginBottom: Spacing.three,
    },
    stepTitle: {
      color: colors.textSecondary,
      ...Typography.base,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.two,
    },
    cta: {
      marginHorizontal: Spacing.four,
      marginTop: 0,
    },
  });
}
