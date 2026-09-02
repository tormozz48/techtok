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
      paddingBottom: Spacing.six,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.four,
    },
    sourceName: {
      color: colors.textSecondary,
      ...Typography.sm,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    toggleText: {
      color: colors.primary,
      ...Typography.sm,
      fontWeight: '600',
    },
    heading: {
      color: colors.text,
      ...Typography.lg,
      fontWeight: '700',
      marginTop: Spacing.three,
      marginBottom: Spacing.two,
    },
    paragraph: {
      color: colors.text,
      ...Typography.md,
      marginBottom: Spacing.three,
    },
    quote: {
      color: colors.textSecondary,
      ...Typography.md,
      fontStyle: 'italic',
      borderLeftColor: colors.primary,
      borderLeftWidth: 2,
      paddingLeft: Spacing.three,
      marginBottom: Spacing.three,
    },
    list: {
      marginBottom: Spacing.three,
    },
    listItem: {
      color: colors.text,
      ...Typography.md,
      marginBottom: Spacing.one,
    },
    figure: {
      marginBottom: Spacing.three,
    },
    figureImage: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: Radius.md,
    },
    figureCaption: {
      color: colors.textSecondary,
      ...Typography.sm,
      marginTop: Spacing.one,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      marginTop: Spacing.four,
    },
  });
}
