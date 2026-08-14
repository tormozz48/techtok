import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { Spacing, type ThemeColors, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

export interface ScreenStateProps {
  readonly loading?: boolean;
  readonly spinnerColor?: string;
  readonly caption?: string;
  readonly message?: string;
  readonly messageColor?: string;
  readonly retryLabel?: string;
  readonly onRetry?: () => void;
}

/** Centered loading/error/empty state — a spinner, an optional caption below
 * it, an optional message, and an optional retry button. Shared by the feed,
 * reader, history, saved and stats screens. */
export function ScreenState({
  loading,
  spinnerColor,
  caption,
  message,
  messageColor,
  retryLabel,
  onRetry,
}: ScreenStateProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasRetry = Boolean(onRetry && retryLabel);

  return (
    <View style={styles.center}>
      {loading ? <ActivityIndicator color={spinnerColor ?? colors.textSecondary} /> : null}
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      {message ? (
        <Text
          style={[
            styles.message,
            { color: messageColor ?? colors.textSecondary },
            hasRetry && styles.messageWithButton,
          ]}
        >
          {message}
        </Text>
      ) : null}
      {hasRetry ? (
        <Button mode="contained" onPress={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.four,
    },
    caption: {
      color: colors.textSecondary,
      ...Typography.sm,
      marginTop: Spacing.three,
    },
    message: {
      ...Typography.md,
      textAlign: 'center',
    },
    messageWithButton: {
      marginBottom: Spacing.four,
    },
  });
}
