import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';

export interface LanguageFlagRowProps<T extends string> {
  readonly items: readonly T[];
  readonly isSelected: (item: T) => boolean;
  readonly flag: (item: T) => string;
  readonly accessibilityLabel: (item: T) => string;
  readonly onSelect: (item: T) => void;
  readonly disabled?: boolean;
  readonly buttonStyle: StyleProp<ViewStyle>;
  readonly buttonSelectedStyle: StyleProp<ViewStyle>;
}

export function LanguageFlagRow<T extends string>({
  items,
  isSelected,
  flag,
  accessibilityLabel,
  onSelect,
  disabled,
  buttonStyle,
  buttonSelectedStyle,
}: LanguageFlagRowProps<T>) {
  return (
    <View style={styles.row}>
      {items.map((item) => {
        const selected = isSelected(item);
        return (
          <Pressable
            key={item}
            onPress={() => onSelect(item)}
            disabled={disabled}
            style={[styles.button, buttonStyle, selected && buttonSelectedStyle]}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel(item)}
            accessibilityState={{ selected, disabled }}
          >
            <Text style={styles.flag}>{flag(item)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: {
    fontSize: 28,
  },
});
