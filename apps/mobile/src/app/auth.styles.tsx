import { StyleSheet } from 'react-native';
import { Radius, Spacing, type ThemeColors, Typography } from '@/constants/theme';

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'space-between',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.four,
    },
    title: {
      color: colors.text,
      ...Typography.xl,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: Spacing.two,
    },
    subtitle: {
      color: colors.textSecondary,
      ...Typography.base,
      textAlign: 'center',
    },
    error: {
      color: colors.error,
      ...Typography.base,
      textAlign: 'center',
      marginTop: Spacing.three,
    },
    cta: {
      margin: Spacing.four,
      borderRadius: Radius.md,
    },
  });
}
