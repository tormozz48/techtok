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
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, List } from 'react-native-paper';
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
            <List.Item
              key={lang}
              title={LANGUAGE_LABELS[lang]}
              onPress={() => chooseLanguage(lang)}
              style={[styles.row, selected && styles.rowSelected]}
              titleStyle={styles.rowText}
              right={
                selected
                  ? (props) => <List.Icon {...props} icon="check" color={Colors.dark.text} />
                  : undefined
              }
            />
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
            <List.Item
              key={topic}
              title={getTopicLabel(topic, language)}
              onPress={() => toggleTopic(topic)}
              disabled={isLoading}
              style={[styles.row, selected && styles.rowSelected]}
              titleStyle={styles.rowText}
              right={
                selected
                  ? (props) => <List.Icon {...props} icon="check" color={Colors.dark.text} />
                  : undefined
              }
            />
          );
        })}
      </ScrollView>
      <Button mode="contained" onPress={getStarted} style={styles.cta}>
        {strings.onboarding.cta}
      </Button>
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
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: Radius.md,
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
  cta: {
    margin: Spacing.four,
    marginTop: 0,
  },
});
