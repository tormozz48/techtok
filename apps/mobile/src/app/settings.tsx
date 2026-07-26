import { useQueryClient } from '@tanstack/react-query';
import {
  getTopicLabel,
  LANGUAGE_FLAGS,
  LANGUAGE_LABELS,
  LANGUAGES,
  type Language,
  TOPICS,
  type Topic,
} from '@techtok/shared';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { LanguageFlagRow } from '@/components/LanguageFlagRow';
import { SelectableList } from '@/components/SelectableList';
import { Spacing, type ThemeColors } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';
import { useTopicsStore } from '@/state/topicsStore';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { topics, isLoading, load, setTopics } = useTopicsStore();
  const { language, setLanguage } = useLanguageStore();
  const strings = useStrings();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTopic = async (topic: Topic) => {
    const next = topics.includes(topic) ? topics.filter((t) => t !== topic) : [...topics, topic];
    await setTopics(next);
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  const chooseLanguage = async (next: Language) => {
    await setLanguage(next);
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{strings.settings.languageSectionTitle}</Text>
      <LanguageFlagRow
        items={LANGUAGES}
        isSelected={(lang) => language === lang}
        flag={(lang) => LANGUAGE_FLAGS[lang]}
        accessibilityLabel={(lang) => LANGUAGE_LABELS[lang]}
        onSelect={chooseLanguage}
        buttonStyle={styles.flagButton}
        buttonSelectedStyle={styles.flagButtonSelected}
      />
      <Text style={styles.hint}>
        {topics.length === 0
          ? strings.settings.hintAll
          : strings.settings.hintSome(topics.length, TOPICS.length)}
      </Text>
      <SelectableList
        items={TOPICS}
        isSelected={(topic) => topics.includes(topic)}
        label={(topic) => getTopicLabel(topic, language)}
        onSelect={toggleTopic}
        disabled={isLoading}
        rowStyle={styles.row}
        rowSelectedStyle={styles.rowSelected}
        rowTextStyle={styles.rowText}
        checkIconColor={colors.text}
      />
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: Spacing.four,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.two,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: Spacing.three,
      marginBottom: Spacing.three,
    },
    row: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      marginBottom: Spacing.two,
    },
    rowSelected: {
      backgroundColor: colors.backgroundSelected,
    },
    rowText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    flagButton: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      paddingVertical: Spacing.three,
    },
    flagButtonSelected: {
      backgroundColor: colors.backgroundSelected,
    },
  });
}
