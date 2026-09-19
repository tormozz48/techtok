import { StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';

export interface QuotaBadgeProps {
  readonly cardReads: number;
  readonly cardReadsLimit: number;
  readonly readerOpens: number;
  readonly readerOpensLimit: number;
}

const ICON_SIZE = 13;

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.overlay.chipBackground,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    gap: Spacing.two,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: Colors.overlay.textSecondary,
  },
  text: {
    color: Colors.overlay.text,
    ...Typography.xs,
    fontWeight: '600',
  },
});

export function QuotaBadge({
  cardReads,
  cardReadsLimit,
  readerOpens,
  readerOpensLimit,
}: QuotaBadgeProps) {
  const strings = useStrings();
  const cardReadsCount = strings.quota.remaining(cardReads, cardReadsLimit);
  const readerOpensCount = strings.quota.remaining(readerOpens, readerOpensLimit);
  return (
    <View style={styles.badge}>
      <View
        style={styles.counter}
        accessible
        accessibilityLabel={`${strings.quota.cardReadsLabel}: ${cardReadsCount}`}
      >
        <Icon source="cards-outline" size={ICON_SIZE} color={Colors.overlay.text} />
        <Text style={styles.text}>{cardReadsCount}</Text>
      </View>
      <View style={styles.divider} />
      <View
        style={styles.counter}
        accessible
        accessibilityLabel={`${strings.quota.readerOpensLabel}: ${readerOpensCount}`}
      >
        <Icon source="book-open-outline" size={ICON_SIZE} color={Colors.overlay.text} />
        <Text style={styles.text}>{readerOpensCount}</Text>
      </View>
    </View>
  );
}
