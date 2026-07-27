import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { SelectableList } from './SelectableList';

const TOPICS = ['ai', 'dev', 'gadgets', 'startups', 'security', 'science', 'space', 'bio'] as const;

function StatefulSelectableList() {
  const colors = useThemeColors();
  const [selected, setSelected] = useState<(typeof TOPICS)[number][]>(['ai', 'science']);
  const styles = StyleSheet.create({
    row: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      marginBottom: 8,
    },
    rowSelected: {
      backgroundColor: colors.backgroundSelected,
    },
    rowText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SelectableList
      items={TOPICS}
      isSelected={(topic) => selected.includes(topic)}
      label={(topic) => topic}
      onSelect={(topic) =>
        setSelected((prev) =>
          prev.includes(topic) ? prev.filter((item) => item !== topic) : [...prev, topic],
        )
      }
      rowStyle={styles.row}
      rowSelectedStyle={styles.rowSelected}
      rowTextStyle={styles.rowText}
      checkIconColor={colors.text}
    />
  );
}

const meta: Meta<typeof StatefulSelectableList> = {
  title: 'components/SelectableList',
  component: StatefulSelectableList,
};

export default meta;

type Story = StoryObj<typeof StatefulSelectableList>;

export const Default: Story = {};
