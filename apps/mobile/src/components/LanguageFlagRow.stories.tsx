import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { LanguageFlagRow } from './LanguageFlagRow';

const LANGUAGES = ['en', 'ru', 'uk', 'pl'] as const;
const FLAGS: Record<(typeof LANGUAGES)[number], string> = {
  en: '🇬🇧',
  ru: '🇷🇺',
  uk: '🇺🇦',
  pl: '🇵🇱',
};

function StatefulLanguageFlagRow() {
  const colors = useThemeColors();
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>('en');
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
      flag={(lang) => FLAGS[lang]}
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
