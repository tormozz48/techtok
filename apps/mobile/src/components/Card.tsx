import type { Card as CardData } from '@techtok/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { enqueueRead } from '@/state/readQueue';
import { timeAgo } from '@/utils/timeAgo';

export interface CardProps {
  card: CardData;
}

export function Card({ card }: CardProps) {
  const { height } = useWindowDimensions();

  return (
    <View style={[styles.container, { height }]}>
      {card.imageUrl ? (
        <Image
          source={{ uri: card.imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.imageFallback]} />
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Pressable
        style={styles.content}
        onPress={() => {
          enqueueRead(card.id);
          WebBrowser.openBrowserAsync(card.url);
        }}
      >
        <View style={styles.topicChip}>
          <Text style={styles.topicChipText}>{card.primaryTopic}</Text>
        </View>
        <Text style={styles.title}>{card.title}</Text>
        <Text style={styles.summary} numberOfLines={4}>
          {card.summary}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{card.sourceName}</Text>
          <Text style={styles.metaText}> · {timeAgo(card.publishedAt)}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  imageFallback: {
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  topicChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginBottom: Spacing.three,
  },
  topicChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    marginBottom: Spacing.two,
  },
  summary: {
    color: '#E0E1E6',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: Spacing.three,
  },
  meta: {
    flexDirection: 'row',
  },
  metaText: {
    color: '#B0B4BA',
    fontSize: 13,
    fontWeight: '600',
  },
});
