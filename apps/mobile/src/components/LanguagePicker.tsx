import { LANGUAGE_FLAGS, LANGUAGE_LABELS, LANGUAGES, type Language } from '@techtok/shared';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { LanguageFlagRow } from '@/components/LanguageFlagRow';
import { Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

export interface LanguagePickerProps {
  readonly language: Language;
  readonly onChange: (next: Language) => void;
  readonly disabled?: boolean;
}

export function LanguagePicker({ language, onChange, disabled }: LanguagePickerProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <LanguageFlagRow
      items={LANGUAGES}
      isSelected={(lang) => language === lang}
      flag={(lang) => LANGUAGE_FLAGS[lang]}
      accessibilityLabel={(lang) => LANGUAGE_LABELS[lang]}
      onSelect={onChange}
      disabled={disabled}
      buttonStyle={styles.flagButton}
      buttonSelectedStyle={styles.flagButtonSelected}
    />
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flagButton: {
      backgroundColor: colors.backgroundElement,
      borderRadius: Radius.md,
      paddingVertical: Spacing.three,
    },
    flagButtonSelected: {
      backgroundColor: colors.backgroundSelected,
    },
  });
}
