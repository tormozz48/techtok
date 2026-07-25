import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { List } from 'react-native-paper';
import { Colors } from '@/constants/theme';

export interface SelectableListProps<T extends string> {
  readonly items: readonly T[];
  readonly isSelected: (item: T) => boolean;
  readonly label: (item: T) => string;
  readonly onSelect: (item: T) => void;
  readonly disabled?: boolean;
  readonly rowStyle: StyleProp<ViewStyle>;
  readonly rowSelectedStyle: StyleProp<ViewStyle>;
  readonly rowTextStyle: StyleProp<TextStyle>;
}

/** A list of toggleable rows with a checkmark on the selected one(s) — shared
 * by the settings and onboarding screens' language/topic pickers. */
export function SelectableList<T extends string>({
  items,
  isSelected,
  label,
  onSelect,
  disabled,
  rowStyle,
  rowSelectedStyle,
  rowTextStyle,
}: SelectableListProps<T>) {
  return (
    <>
      {items.map((item) => {
        const selected = isSelected(item);
        return (
          <List.Item
            key={item}
            title={label(item)}
            onPress={() => onSelect(item)}
            disabled={disabled}
            style={[rowStyle, selected && rowSelectedStyle]}
            titleStyle={rowTextStyle}
            right={
              selected
                ? (props) => <List.Icon {...props} icon="check" color={Colors.dark.text} />
                : undefined
            }
          />
        );
      })}
    </>
  );
}
