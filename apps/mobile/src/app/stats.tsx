import { useQuery } from '@tanstack/react-query';
import { getTopicLabel, type HistoryItem } from '@techtok/shared';
import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchHistoryPage } from '@/api/client';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';
import { computeReadingStats } from '@/utils/readingStats';

// Same bound as the history/bookmarks search (C1) — an honest "based on
// your most recent ~500 reads" contract instead of paging to exhaustion.
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
  const { data, isLoading, isError } = useQuery({
    queryKey: ['stats-history'],
    queryFn: fetchHistoryForStats,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{strings.stats.error}</Text>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{strings.stats.empty}</Text>
      </View>
    );
  }

  const stats = computeReadingStats(data);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tileRow}>
        <StatTile value={stats.readsThisWeek} label={strings.stats.thisWeek} />
        <StatTile value={stats.readsThisMonth} label={strings.stats.thisMonth} />
        <StatTile value={stats.streakDays} label={strings.stats.streak} />
      </View>

      {stats.topTopics.length > 0 ? (
        <RankedSection title={strings.stats.topTopics}>
          {stats.topTopics.map(({ topic, count }) => (
            <RankedRow key={topic} label={getTopicLabel(topic, language)} count={count} />
          ))}
        </RankedSection>
      ) : null}

      {stats.topSources.length > 0 ? (
        <RankedSection title={strings.stats.topSources}>
          {stats.topSources.map(({ sourceName, count }) => (
            <RankedRow key={sourceName} label={sourceName} count={count} />
          ))}
        </RankedSection>
      ) : null}
    </ScrollView>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function RankedSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function RankedRow({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowCount}>{count}</Text>
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
  center: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    fontSize: 16,
  },
  tileRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  tile: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  tileValue: {
    color: Colors.dark.text,
    ...Typography.xxl,
    fontWeight: '700',
  },
  tileLabel: {
    color: Colors.dark.textSecondary,
    ...Typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  section: {
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginBottom: Spacing.two,
  },
  rowLabel: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
  rowCount: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
});
