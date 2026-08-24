import { useQuery } from '@tanstack/react-query';
import { getTopicLabel, type HistoryItem } from '@techtok/shared';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { fetchHistoryPage } from '@/api/client';
import { ScreenState } from '@/components/ScreenState';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';
import { computeReadingStats } from '@/utils/readingStats';
import { createStyles, type StatsStyles } from './stats.styles';

const MAX_ITEMS = 500;
const PAGE_SIZE = 100;

async function fetchHistoryForStats(): Promise<HistoryItem[]> {
  const items: HistoryItem[] = [];
  let cursor: string | undefined;

  while (items.length < MAX_ITEMS) {
    const page = await fetchHistoryPage({ cursor, limit: PAGE_SIZE });
    items.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return items;
}

export default function StatsScreen() {
  const strings = useStrings();
  const language = useLanguageStore((state) => state.language);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['stats-history'],
    queryFn: fetchHistoryForStats,
  });

  if (isLoading) {
    return <ScreenState loading />;
  }

  if (isError || !data) {
    return <ScreenState message={strings.stats.error} />;
  }

  if (data.length === 0) {
    return <ScreenState message={strings.stats.empty} />;
  }

  const stats = computeReadingStats(data);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tileRow}>
        <StatTile styles={styles} value={stats.readsThisWeek} label={strings.stats.thisWeek} />
        <StatTile styles={styles} value={stats.readsThisMonth} label={strings.stats.thisMonth} />
        <StatTile styles={styles} value={stats.streakDays} label={strings.stats.streak} />
      </View>

      {stats.topTopics.length > 0 ? (
        <RankedSection styles={styles} title={strings.stats.topTopics}>
          {stats.topTopics.map(({ topic, count }) => (
            <RankedRow
              key={topic}
              styles={styles}
              label={getTopicLabel(topic, language)}
              count={count}
            />
          ))}
        </RankedSection>
      ) : null}

      {stats.topSources.length > 0 ? (
        <RankedSection styles={styles} title={strings.stats.topSources}>
          {stats.topSources.map(({ sourceName, count }) => (
            <RankedRow key={sourceName} styles={styles} label={sourceName} count={count} />
          ))}
        </RankedSection>
      ) : null}
    </ScrollView>
  );
}

function StatTile({ styles, value, label }: { styles: StatsStyles; value: number; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function RankedSection({
  styles,
  title,
  children,
}: {
  styles: StatsStyles;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function RankedRow({
  styles,
  label,
  count,
}: {
  styles: StatsStyles;
  label: string;
  count: number;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowCount}>{count}</Text>
    </View>
  );
}
