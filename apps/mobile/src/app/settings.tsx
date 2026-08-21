import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Language, Topic } from '@techtok/shared';
import { Link } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { List, Switch } from 'react-native-paper';
import { fetchSources } from '@/api/client';
import { useEntitlementQuery } from '@/api/useEntitlementQuery';
import { BuildInfo } from '@/components/BuildInfo';
import { LanguagePicker } from '@/components/LanguagePicker';
import { SelectableList } from '@/components/SelectableList';
import { TopicPicker } from '@/components/TopicPicker';
import { Spacing, type ThemeColors } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { logError } from '@/state/eventsQueue';
import { useHapticsStore } from '@/state/hapticsStore';
import { useLanguageStore } from '@/state/languageStore';
import { useMutedSourcesStore } from '@/state/mutedSourcesStore';
import { type ThemeMode, useThemeStore } from '@/state/themeStore';
import { useTopicsStore } from '@/state/topicsStore';

const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { topics, isLoading, load, setTopics } = useTopicsStore();
  const { language, setLanguage } = useLanguageStore();
  const { mode, setMode } = useThemeStore();
  const { enabled: hapticsEnabled, setEnabled: setHapticsEnabled } = useHapticsStore();
  const {
    mutedSources,
    isLoading: isMutedSourcesLoading,
    load: loadMutedSources,
    setMutedSources,
  } = useMutedSourcesStore();
  const sourcesQuery = useQuery({ queryKey: ['sources'], queryFn: fetchSources });
  const entitlementQuery = useEntitlementQuery();
  const strings = useStrings();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const entitlement = entitlementQuery.data;
  const planDescription = entitlement
    ? entitlement.plan === 'plus'
      ? strings.quota.planPlus
      : `${strings.quota.planFree} · ${strings.quota.remaining(entitlement.quota.cardReads, entitlement.quota.cardReadsLimit)}`
    : undefined;

  useEffect(() => {
    load();
    loadMutedSources();
  }, [load, loadMutedSources]);

  const applyTopics = async (next: Topic[]) => {
    await setTopics(next);
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  const applyLanguage = async (next: Language) => {
    try {
      await setLanguage(next);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (error) {
      // setLanguage already rolled the store back on a genuine failure (see
      // languageStore.ts) — this just stops the rejection from going
      // unhandled and leaves a trace of why the picker reverted.
      logError('applyLanguage failed', { message: String(error) });
    }
  };

  const toggleMutedSource = async (sourceId: string) => {
    const next = mutedSources.includes(sourceId)
      ? mutedSources.filter((id) => id !== sourceId)
      : [...mutedSources, sourceId];
    await setMutedSources(next);
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  const themeLabel = (themeMode: ThemeMode) =>
    ({
      system: strings.settings.themeSystem,
      light: strings.settings.themeLight,
      dark: strings.settings.themeDark,
    })[themeMode];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{strings.settings.themeSectionTitle}</Text>
      <SelectableList
        items={THEME_MODES}
        isSelected={(themeMode) => mode === themeMode}
        label={themeLabel}
        onSelect={setMode}
        rowStyle={styles.row}
        rowSelectedStyle={styles.rowSelected}
        rowTextStyle={styles.rowText}
        checkIconColor={colors.text}
        testIDPrefix="settings-theme"
      />
      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
        {strings.settings.languageSectionTitle}
      </Text>
      <LanguagePicker language={language} onChange={applyLanguage} />
      <List.Item
        title={strings.settings.hapticsLabel}
        description={strings.settings.hapticsHint}
        titleStyle={styles.rowText}
        descriptionStyle={styles.rowDescription}
        style={StyleSheet.flatten([styles.row, styles.sectionTitleSpaced])}
        onPress={() => setHapticsEnabled(!hapticsEnabled)}
        right={() => (
          <Switch
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
            accessibilityLabel={strings.settings.hapticsLabel}
            testID="settings-haptics-switch"
          />
        )}
        testID="settings-haptics-row"
      />
      <Link href="/stats" asChild>
        <List.Item
          title={strings.stats.title}
          titleStyle={styles.rowText}
          style={styles.row}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.text} />}
          testID="settings-stats-link"
        />
      </Link>
      <Link href="/account" asChild>
        <List.Item
          title={strings.account.title}
          titleStyle={styles.rowText}
          style={styles.row}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.text} />}
          testID="settings-account-link"
        />
      </Link>
      <Link href="/paywall" asChild>
        <List.Item
          title={strings.paywall.title}
          description={planDescription}
          titleStyle={styles.rowText}
          descriptionStyle={styles.rowDescription}
          style={styles.row}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.text} />}
          testID="settings-paywall-link"
        />
      </Link>
      <TopicPicker
        topics={topics}
        language={language}
        isLoading={isLoading}
        hintAll={strings.settings.hintAll}
        hintSome={strings.settings.hintSome}
        onChange={applyTopics}
        testIDPrefix="settings-topic"
      />
      {sourcesQuery.data ? (
        <>
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
            {strings.settings.sourcesSectionTitle}
          </Text>
          <Text style={styles.hint}>{strings.settings.sourcesHint}</Text>
          <SelectableList
            items={sourcesQuery.data.sources.map((source) => source.sourceId)}
            isSelected={(sourceId) => mutedSources.includes(sourceId)}
            label={(sourceId) =>
              sourcesQuery.data.sources.find((source) => source.sourceId === sourceId)?.name ??
              sourceId
            }
            onSelect={toggleMutedSource}
            disabled={isMutedSourcesLoading}
            rowStyle={styles.row}
            rowSelectedStyle={styles.rowSelected}
            rowTextStyle={styles.rowText}
            checkIconColor={colors.text}
            testIDPrefix="settings-source"
          />
        </>
      ) : null}
      <View style={styles.sectionTitleSpaced}>
        <BuildInfo />
      </View>
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
      paddingBottom: Spacing.six,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.two,
    },
    sectionTitleSpaced: {
      marginTop: Spacing.four,
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
    rowDescription: {
      color: colors.textSecondary,
      fontSize: 13,
    },
  });
}
