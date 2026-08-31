import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';

export interface QuotaBadgeProps {
  readonly used: number;
  readonly limit: number;
  readonly label?: string;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    backgroundColor: Colors.overlay.chipBackground,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  text: {
    color: Colors.overlay.text,
    ...Typography.sm,
    fontWeight: '600',
  },
});

export function QuotaBadge({ used, limit, label }: QuotaBadgeProps) {
  const strings = useStrings();
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>
        {label ? `${label} ` : ''}
        {strings.quota.remaining(used, limit)}
      </Text>
    </View>
  );
}
