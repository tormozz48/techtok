import {
  getTopicLabel,
  LANGUAGE_FLAGS,
  LANGUAGE_LABELS,
  LANGUAGES,
  type Language,
  TOPICS,
  type Topic,
} from '@techtok/shared';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageFlagRow } from '@/components/LanguageFlagRow';
import { SelectableList } from '@/components/SelectableList';
import { Radius, Spacing, type ThemeColors, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';
import { markOnboardingSeen } from '@/state/onboardingStore';
import { useTopicsStore } from '@/state/topicsStore';

export default function OnboardingScreen() {
  const { topics, isLoading, load, setTopics } = useTopicsStore();
  const { language, load: loadLanguage, setLanguage } = useLanguageStore();
  const strings = useStrings();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
            ? strings.onboarding.hintAll
            : strings.onboarding.hintSome(topics.length, TOPICS.length)}
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
      <Button
        mode="contained"
        onPress={getStarted}
        style={[styles.cta, { marginBottom: Spacing.four + insets.bottom }]}
      >
        {strings.onboarding.cta}
      </Button>
    </View>
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
    title: {
      color: colors.text,
      ...Typography.xl,
      fontWeight: '700',
      marginBottom: Spacing.three,
    },
    stepTitle: {
      color: colors.textSecondary,
      ...Typography.base,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.two,
    },
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
    flagButton: {
      backgroundColor: colors.backgroundElement,
      borderRadius: Radius.md,
      paddingVertical: Spacing.three,
    },
    flagButtonSelected: {
      backgroundColor: colors.backgroundSelected,
    },
    cta: {
      marginHorizontal: Spacing.four,
      marginTop: 0,
    },
  });
}
