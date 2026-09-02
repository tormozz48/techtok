import type { Card as CardData } from '@techtok/shared';
import { getTopicLabel } from '@techtok/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Chip, TouchableRipple } from 'react-native-paper';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';
import { enqueueRead } from '@/state/readQueue';
import { translationFeedbackMailto } from '@/utils/feedback';
import { timeAgo } from '@/utils/timeAgo';
import { ImageSkeleton } from './ImageSkeleton';
import { ImageStub } from './ImageStub';

export interface CardProps {
  card: CardData;
}

const styles = StyleSheet.create({
  container: {
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
    backgroundColor: 'transparent',
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
  sourceCountText: {
    color: Colors.overlay.textSecondary,
    ...Typography.xs,
    marginTop: Spacing.half,
  },
  debugBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.overlay.debugBackground,
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

export function Card({ card }: CardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const strings = useStrings();
  const language = useLanguageStore((state) => state.language);

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

      <TouchableRipple
        style={styles.content}
        testID="feed-card"
        onPress={() => {
          enqueueRead(card.id);
          router.push({
            pathname: '/post/[id]',
            params: {
              id: card.id,
              title: card.title,
              sourceName: card.sourceName,
              url: card.url,
              isBookmarked: String(card.isBookmarked ?? false),
            },
          });
        }}
        onLongPress={
          card.isTranslated
            ? () => {
                Linking.openURL(translationFeedbackMailto(card.id, card.servedLang)).catch(
                  () => {},
                );
              }
            : undefined
        }
      >
        {/* biome-ignore lint/complexity/noUselessFragments: TouchableRipple calls React.Children.only, so multiple children need a single wrapping element. */}
        <>
          {__DEV__ && card.transform ? (
            <Chip compact style={styles.debugBadge} textStyle={styles.debugBadgeText}>
              {card.transform}
            </Chip>
          ) : null}
          <Chip compact style={styles.topicChip} textStyle={styles.topicChipText}>
            {getTopicLabel(card.primaryTopic, language)}
          </Chip>
          {card.isTranslated ? (
            <Chip
              compact
              mode="outlined"
              style={styles.translatedBadge}
              textStyle={styles.translatedBadgeText}
            >
              {strings.card.translatedBadge}
            </Chip>
          ) : null}
          <Text style={styles.title} testID="feed-card-title">
            {card.title}
          </Text>
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
            <Text style={styles.metaText}> · {timeAgo(card.publishedAt, strings.time)}</Text>
          </View>
          {card.sourceCount ? (
            <Text style={styles.sourceCountText}>{strings.card.sourceCount(card.sourceCount)}</Text>
          ) : null}
        </>
      </TouchableRipple>
    </View>
  );
}
