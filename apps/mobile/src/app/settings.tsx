import { useQueryClient } from '@tanstack/react-query';
import { TOPIC_LABELS, TOPICS, type Topic } from '@techtok/shared';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { useTopicsStore } from '@/state/topicsStore';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { topics, isLoading, load, setTopics } = useTopicsStore();

  useEffect(() => {
    load();
  }, [load]);

  const toggleTopic = async (topic: Topic) => {
    const next = topics.includes(topic) ? topics.filter((t) => t !== topic) : [...topics, topic];
    await setTopics(next);
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        {topics.length === 0
          ? 'Showing all topics. Select any to narrow your feed.'
          : `Showing ${topics.length} of ${TOPICS.length} topics.`}
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
            <Text style={styles.rowText}>{TOPIC_LABELS[topic]}</Text>
            {selected ? <Text style={styles.rowCheck}>✓</Text> : null}
          </Pressable>
        );
      })}
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
  hint: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
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
});
