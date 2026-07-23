import type { Card as CardData } from '@techtok/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { enqueueRead } from '@/state/readQueue';
import { timeAgo } from '@/utils/timeAgo';
import { ImageSkeleton } from './ImageSkeleton';
import { ImageStub } from './ImageStub';

export interface CardProps {
  card: CardData;
}

export function Card({ card }: CardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const strings = useStrings();

  return (
    <View style={styles.container}>
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
        <ImageStub postId={card.id} topic={card.primaryTopic} />
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
        {card.isTranslated ? (
          <View style={styles.translatedBadge}>
            <Text style={styles.translatedBadgeText}>{strings.card.translatedBadge}</Text>
          </View>
        ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // react-native-pager-view's own docs: `flex: 1` does not size a page's
    // children correctly, use an explicit width/height instead — 100% then
    // resolves against whatever height the pager itself is given by its
    // parent (FeedScreen's layout, D25), so the pager shrinking for the
    // bottom action bar "just works" without any bar-height arithmetic here.
    width: '100%',
    height: '100%',
    backgroundColor: Colors.overlay.surfaceBlack,
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
  translatedBadge: {
    alignSelf: 'flex-start',
    borderColor: Colors.overlay.accent,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginBottom: Spacing.three,
  },
  translatedBadgeText: {
    color: Colors.overlay.accent,
    ...Typography.xs,
    fontWeight: '600',
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
});
