import {
  getTopicLabel,
  LANGUAGE_LABELS,
  LANGUAGES,
  type Language,
  TOPICS,
  type Topic,
} from '@techtok/shared';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';
import { markOnboardingSeen } from '@/state/onboardingStore';
import { useTopicsStore } from '@/state/topicsStore';

export default function OnboardingScreen() {
  const { topics, isLoading, load, setTopics } = useTopicsStore();
  const { language, load: loadLanguage, setLanguage } = useLanguageStore();
  const strings = useStrings();

  useEffect(() => {
    load();
    loadLanguage();
  }, [load, loadLanguage]);

  const toggleTopic = async (topic: Topic) => {
    const next = topics.includes(topic) ? topics.filter((t) => t !== topic) : [...topics, topic];
    await setTopics(next);
  };

  const chooseLanguage = async (next: Language) => {
    await setLanguage(next);
  };

  const getStarted = () => {
    markOnboardingSeen();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{strings.onboarding.title}</Text>

        <Text style={styles.stepTitle}>{strings.onboarding.languageStepTitle}</Text>
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
            ? strings.onboarding.hintAll
            : strings.onboarding.hintSome(topics.length, TOPICS.length)}
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
      </ScrollView>
      <Pressable style={styles.cta} onPress={getStarted}>
        <Text style={styles.ctaText}>{strings.onboarding.cta}</Text>
      </Pressable>
    </View>
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
  title: {
    color: Colors.dark.text,
    ...Typography.xl,
    fontWeight: '700',
    marginBottom: Spacing.three,
  },
  stepTitle: {
    color: Colors.dark.textSecondary,
    ...Typography.base,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  hint: {
    color: Colors.dark.textSecondary,
    ...Typography.base,
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginBottom: Spacing.two,
  },
  rowSelected: {
    backgroundColor: Colors.dark.backgroundSelected,
  },
  rowText: {
    color: Colors.dark.text,
    ...Typography.md,
    fontWeight: '600',
  },
  rowCheck: {
    color: Colors.dark.text,
    ...Typography.md,
    fontWeight: '700',
  },
  cta: {
    margin: Spacing.four,
    marginTop: 0,
    backgroundColor: Colors.dark.text,
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  ctaText: {
    color: Colors.dark.background,
    ...Typography.md,
    fontWeight: '700',
  },
});
