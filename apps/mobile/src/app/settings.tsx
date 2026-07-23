import { useQueryClient } from '@tanstack/react-query';
import {
  getTopicLabel,
  LANGUAGE_LABELS,
  LANGUAGES,
  type Language,
  TOPICS,
  type Topic,
} from '@techtok/shared';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';
import { enablePushNotifications, isPushEnabled } from '@/state/pushNotifications';
import { useTopicsStore } from '@/state/topicsStore';

const FEEDBACK_MAILTO = 'mailto:andrii@numica.com?subject=TechTok%20feedback';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { topics, isLoading, load, setTopics } = useTopicsStore();
  const { language, setLanguage } = useLanguageStore();
  const [pushEnabled, setPushEnabled] = useState(isPushEnabled);
  const strings = useStrings();

  useEffect(() => {
    load();
  }, [load]);

  const handleEnablePush = async () => {
    const enabled = await enablePushNotifications();
    setPushEnabled(enabled);
  };

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
      {LANGUAGES.map((lang) => {
        const selected = language === lang;
        return (
          <Pressable
            key={lang}
            style={[styles.row, selected && styles.rowSelected]}
            onPress={() => chooseLanguage(lang)}
          >
            <Text style={styles.rowText}>{LANGUAGE_LABELS[lang]}</Text>
            {selected ? <Text style={styles.rowCheck}>✓</Text> : null}
          </Pressable>
        );
      })}
      <Text style={styles.hint}>
        {topics.length === 0
          ? strings.settings.hintAll
          : strings.settings.hintSome(topics.length, TOPICS.length)}
      </Text>
      {TOPICS.map((topic) => {
        const selected = topics.includes(topic);
        return (
          <Pressable
            key={topic}
            style={[styles.row, selected && styles.rowSelected]}
            onPress={() => toggleTopic(topic)}
            disabled={isLoading}
          >
            <Text style={styles.rowText}>{getTopicLabel(topic, language)}</Text>
            {selected ? <Text style={styles.rowCheck}>✓</Text> : null}
          </Pressable>
        );
      })}
      <Pressable style={styles.feedbackRow} onPress={handleEnablePush} disabled={pushEnabled}>
        <Text style={styles.feedbackText}>
          {pushEnabled ? strings.settings.pushEnabled : strings.settings.pushEnable}
        </Text>
      </Pressable>
      <Pressable style={styles.feedbackRow} onPress={() => Linking.openURL(FEEDBACK_MAILTO)}>
        <Text style={styles.feedbackText}>{strings.settings.feedback}</Text>
      </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
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
  rowCheck: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  feedbackRow: {
    alignItems: 'center',
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 12,
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
  },
  feedbackText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
