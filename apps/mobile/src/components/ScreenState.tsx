import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { Spacing, type ThemeColors, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

export interface ScreenStateProps {
  readonly loading?: boolean;
  readonly spinnerColor?: string;
  readonly caption?: string;
  readonly title?: string;
  readonly message?: string;
  readonly messageColor?: string;
  readonly retryLabel?: string;
  readonly onRetry?: () => void;
  readonly retryTestID?: string;
}

export function ScreenState({
  loading,
  spinnerColor,
  caption,
  title,
  message,
  messageColor,
  retryLabel,
  onRetry,
  retryTestID,
}: ScreenStateProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasRetry = Boolean(onRetry && retryLabel);

  return (
    <View style={styles.center}>
      {loading ? <ActivityIndicator color={spinnerColor ?? colors.textSecondary} /> : null}
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
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
        <Button mode="contained" onPress={onRetry} testID={retryTestID}>
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
    title: {
      color: colors.text,
      ...Typography.lg,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: Spacing.two,
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
