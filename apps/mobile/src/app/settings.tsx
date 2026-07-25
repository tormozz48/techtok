import { useQueryClient } from '@tanstack/react-query';
import {
  getTopicLabel,
  LANGUAGE_LABELS,
  LANGUAGES,
  type Language,
  TOPICS,
  type Topic,
} from '@techtok/shared';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SelectableList } from '@/components/SelectableList';
import { Colors, Spacing } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';
import { useTopicsStore } from '@/state/topicsStore';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { topics, isLoading, load, setTopics } = useTopicsStore();
  const { language, setLanguage } = useLanguageStore();
  const strings = useStrings();

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
      <SelectableList
        items={LANGUAGES}
        isSelected={(lang) => language === lang}
        label={(lang) => LANGUAGE_LABELS[lang]}
        onSelect={chooseLanguage}
        rowStyle={styles.row}
        rowSelectedStyle={styles.rowSelected}
        rowTextStyle={styles.rowText}
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
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    padding: Spacing.four,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  hint: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  row: {
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 12,
    marginBottom: Spacing.two,
  },
  rowSelected: {
    backgroundColor: Colors.dark.backgroundSelected,
  },
  rowText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
