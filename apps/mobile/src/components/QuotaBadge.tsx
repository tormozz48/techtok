import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';

export interface QuotaBadgeProps {
  readonly used: number;
  readonly limit: number;
}

/**
 * Compact "12 / 50" pill (D69) — shown over the feed's full-bleed card
 * overlay for free users only; Plus users never see it (the caller decides
 * that, this component just renders whatever numbers it's given). Reuses
 * the overlay chip palette Card.tsx's topic chip already established.
 */
export function QuotaBadge({ used, limit }: QuotaBadgeProps) {
  const strings = useStrings();
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{strings.quota.remaining(used, limit)}</Text>
    </View>
  );
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
