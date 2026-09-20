import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { List } from 'react-native-paper';

export interface SelectableListProps<T extends string> {
  readonly items: readonly T[];
  readonly isSelected: (item: T) => boolean;
  readonly label: (item: T) => string;
  readonly onSelect: (item: T) => void;
  readonly disabled?: boolean;
  readonly isLocked?: (item: T) => boolean;
  readonly onLockedPress?: (item: T) => void;
  readonly lockedAccessibilityLabel?: (item: T) => string;
  readonly rowStyle: StyleProp<ViewStyle>;
  readonly rowSelectedStyle: StyleProp<ViewStyle>;
  readonly rowTextStyle: StyleProp<TextStyle>;
  readonly checkIconColor: string;
  readonly testIDPrefix?: string;
}

export function SelectableList<T extends string>({
  items,
  isSelected,
  label,
  onSelect,
  disabled,
  isLocked,
  onLockedPress,
  lockedAccessibilityLabel,
  rowStyle,
  rowSelectedStyle,
  rowTextStyle,
  checkIconColor,
  testIDPrefix,
}: SelectableListProps<T>) {
  return (
    <>
      {items.map((item) => {
        const locked = isLocked?.(item) ?? false;
        const selected = !locked && isSelected(item);
        return (
          <List.Item
            key={item}
            title={label(item)}
            onPress={() => (locked ? onLockedPress?.(item) : onSelect(item))}
            disabled={disabled}
            style={[rowStyle, selected && rowSelectedStyle]}
            titleStyle={rowTextStyle}
            testID={testIDPrefix ? `${testIDPrefix}-${item}` : undefined}
            accessibilityLabel={locked ? lockedAccessibilityLabel?.(item) : undefined}
            right={
              locked
                ? (props) => <List.Icon {...props} icon="lock" color={checkIconColor} />
                : selected
                  ? (props) => <List.Icon {...props} icon="check" color={checkIconColor} />
                  : undefined
            }
          />
        );
      })}
    </>
  );
}
