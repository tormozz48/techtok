import { TOPIC_LABELS, TOPICS, type Topic } from '@techtok/shared';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { markOnboardingSeen } from '@/state/onboardingStore';
import { useTopicsStore } from '@/state/topicsStore';

export default function OnboardingScreen() {
  const { topics, isLoading, load, setTopics } = useTopicsStore();

  useEffect(() => {
    load();
  }, [load]);

  const toggleTopic = async (topic: Topic) => {
    const next = topics.includes(topic) ? topics.filter((t) => t !== topic) : [...topics, topic];
    await setTopics(next);
  };

  const getStarted = () => {
    markOnboardingSeen();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Welcome to TechTok</Text>
        <Text style={styles.hint}>
          {topics.length === 0
            ? 'Pick the topics you care about, or leave everything on to see it all.'
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
      <Pressable style={styles.cta} onPress={getStarted}>
        <Text style={styles.ctaText}>Get started</Text>
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
    marginBottom: Spacing.two,
  },
  hint: {
    color: Colors.dark.textSecondary,
    ...Typography.base,
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
