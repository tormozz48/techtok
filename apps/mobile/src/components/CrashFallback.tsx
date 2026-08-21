import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';

interface CrashFallbackProps {
  resetError: () => void;
}

export function CrashFallback({ resetError }: CrashFallbackProps) {
  const colors = useThemeColors();
  const strings = useStrings();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{strings.crash.title}</Text>
      <Text style={[styles.message, { color: colors.text }]}>{strings.crash.message}</Text>
      <Pressable
        onPress={resetError}
        style={[styles.button, { backgroundColor: colors.primary }]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonLabel}>{strings.crash.retry}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  title: {
    ...Typography.xl,
    fontWeight: '700',
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  message: {
    ...Typography.base,
    textAlign: 'center',
    marginBottom: Spacing.six,
  },
  button: {
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
  },
  buttonLabel: {
    ...Typography.base,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
