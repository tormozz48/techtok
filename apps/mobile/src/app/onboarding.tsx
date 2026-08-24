import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguagePicker } from '@/components/LanguagePicker';
import { TopicPicker } from '@/components/TopicPicker';
import { Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';
import { markOnboardingSeen } from '@/state/onboardingStore';
import { useTopicsStore } from '@/state/topicsStore';
import { createStyles } from './onboarding.styles';

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

  const getStarted = () => {
    markOnboardingSeen();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{strings.onboarding.title}</Text>

        <Text style={styles.stepTitle}>{strings.onboarding.languageStepTitle}</Text>
        <LanguagePicker language={language} onChange={setLanguage} />

        <TopicPicker
          topics={topics}
          language={language}
          isLoading={isLoading}
          hintAll={strings.onboarding.hintAll}
          hintSome={strings.onboarding.hintSome}
          onChange={setTopics}
          testIDPrefix="onboarding-topic"
        />
      </ScrollView>
      <Button
        mode="contained"
        onPress={getStarted}
        style={[styles.cta, { marginBottom: Spacing.four + insets.bottom }]}
        testID="onboarding-cta"
      >
        {strings.onboarding.cta}
      </Button>
    </View>
  );
}
