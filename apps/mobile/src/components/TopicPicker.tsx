import { getTopicLabel, type Language, TOPICS, type Topic } from '@techtok/shared';
import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SelectableList } from '@/components/SelectableList';
import { Radius, Spacing, type ThemeColors, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

export interface TopicPickerProps {
  readonly topics: readonly Topic[];
  readonly language: Language;
  readonly isLoading?: boolean;
  readonly hintAll: string;
  readonly hintSome: (selected: number, total: number) => string;
  readonly onChange: (next: Topic[]) => void;
  /** Forwarded to the underlying SelectableList — see its own testIDPrefix doc. */
  readonly testIDPrefix?: string;
}

/** Hint text + toggleable topic list — shared by the settings and onboarding
 * screens' topic pickers. */
export function TopicPicker({
  topics,
  language,
  isLoading,
  hintAll,
  hintSome,
  onChange,
  testIDPrefix,
}: TopicPickerProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const toggle = (topic: Topic) => {
    const next = topics.includes(topic) ? topics.filter((t) => t !== topic) : [...topics, topic];
    onChange(next);
  };

  return (
    <>
      <Text style={styles.hint}>
        {topics.length === 0 ? hintAll : hintSome(topics.length, TOPICS.length)}
      </Text>
      <SelectableList
        items={TOPICS}
        isSelected={(topic) => topics.includes(topic)}
        label={(topic) => getTopicLabel(topic, language)}
        onSelect={toggle}
        disabled={isLoading}
        rowStyle={styles.row}
        rowSelectedStyle={styles.rowSelected}
        rowTextStyle={styles.rowText}
        checkIconColor={colors.text}
        testIDPrefix={testIDPrefix}
      />
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    hint: {
      color: colors.textSecondary,
      ...Typography.base,
      marginTop: Spacing.three,
      marginBottom: Spacing.three,
    },
    row: {
      backgroundColor: colors.backgroundElement,
      borderRadius: Radius.md,
      marginBottom: Spacing.two,
    },
    rowSelected: {
      backgroundColor: colors.backgroundSelected,
    },
    rowText: {
      color: colors.text,
      ...Typography.md,
      fontWeight: '600',
    },
  });
}
