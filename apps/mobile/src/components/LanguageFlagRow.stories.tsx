import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { LANGUAGE_FLAGS, LANGUAGES, type Language } from '@techtok/shared';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { LanguageFlagRow } from './LanguageFlagRow';

function StatefulLanguageFlagRow() {
  const colors = useThemeColors();
  const [language, setLanguage] = useState<Language>('en');
  const styles = StyleSheet.create({
    button: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      paddingVertical: 16,
    },
    buttonSelected: {
      backgroundColor: colors.backgroundSelected,
    },
  });

  return (
    <LanguageFlagRow
      items={LANGUAGES}
      isSelected={(lang) => language === lang}
      flag={(lang) => LANGUAGE_FLAGS[lang]}
      accessibilityLabel={(lang) => lang}
      onSelect={setLanguage}
      buttonStyle={styles.button}
      buttonSelectedStyle={styles.buttonSelected}
    />
  );
}

const meta: Meta<typeof StatefulLanguageFlagRow> = {
  title: 'components/LanguageFlagRow',
  component: StatefulLanguageFlagRow,
};

export default meta;

type Story = StoryObj<typeof StatefulLanguageFlagRow>;

export const Default: Story = {};
