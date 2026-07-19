import type { Card as CardData } from '@techtok/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { enqueueRead } from '@/state/readQueue';
import { timeAgo } from '@/utils/timeAgo';
import { BookmarkButton } from './BookmarkButton';
import { ImageSkeleton } from './ImageSkeleton';

export interface CardProps {
  card: CardData;
}

export function Card({ card }: CardProps) {
  const { height } = useWindowDimensions();
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <View style={[styles.container, { height }]}>
      {card.imageUrl ? (
        <>
          <Image
            source={{ uri: card.imageUrl }}
            placeholder={card.blurhash ? { blurhash: card.blurhash } : undefined}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
          />
          {!imageLoaded && !card.blurhash ? <ImageSkeleton /> : null}
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.imageFallback]} />
      )}

      <LinearGradient
        colors={[Colors.overlay.scrimStart, Colors.overlay.scrimEnd]}
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
        {__DEV__ && card.transform ? (
          <View style={styles.debugBadge}>
            <Text style={styles.debugBadgeText}>{card.transform}</Text>
          </View>
        ) : null}
        <View style={styles.topicChip}>
          <Text style={styles.topicChipText}>{card.primaryTopic}</Text>
        </View>
        <Text style={styles.title}>{card.title}</Text>
        <Text style={styles.summary} numberOfLines={4}>
          {card.summary}
        </Text>
        {card.whyItMatters ? (
          <Text style={styles.whyItMatters} numberOfLines={2}>
            {card.whyItMatters}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <Text style={styles.metaText}>{card.sourceName}</Text>
          <Text style={styles.metaText}> · {timeAgo(card.publishedAt)}</Text>
        </View>
      </Pressable>

      <View style={styles.actions} pointerEvents="box-none">
        <BookmarkButton postId={card.id} isBookmarked={card.isBookmarked} />
        <Pressable
          style={styles.actionButton}
          hitSlop={8}
          onPress={() =>
            Share.share({
              title: card.title,
              url: card.url,
              message: Platform.OS === 'android' ? `${card.title}\n${card.url}` : card.title,
            })
          }
        >
          <Text style={styles.actionIcon}>↗</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.overlay.surfaceBlack,
  },
  imageFallback: {
    backgroundColor: Colors.overlay.surfaceDim,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  topicChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.overlay.chipBackground,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginBottom: Spacing.three,
  },
  topicChipText: {
    color: Colors.overlay.text,
    ...Typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    color: Colors.overlay.text,
    ...Typography.xl,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  summary: {
    color: Colors.overlay.textMuted,
    ...Typography.md,
    marginBottom: Spacing.three,
  },
  whyItMatters: {
    color: Colors.overlay.accent,
    ...Typography.base,
    fontStyle: 'italic',
    marginBottom: Spacing.three,
  },
  meta: {
    flexDirection: 'row',
  },
  metaText: {
    color: Colors.overlay.textSecondary,
    ...Typography.sm,
    fontWeight: '600',
  },
  debugBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.overlay.debugBackground,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    marginBottom: Spacing.two,
  },
  debugBadgeText: {
    color: Colors.overlay.debugText,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actions: {
    position: 'absolute',
    top: Spacing.six,
    left: Spacing.three,
    gap: Spacing.two,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.overlay.chipBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    color: Colors.overlay.text,
    fontSize: 18,
  },
});
