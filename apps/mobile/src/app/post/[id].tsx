import { useQuery } from '@tanstack/react-query';
import type { CompactBlock, CompactFigure, Language } from '@techtok/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button, IconButton, TouchableRipple } from 'react-native-paper';
import { ApiError, fetchPostContent } from '@/api/client';
import { BookmarkButton } from '@/components/BookmarkButton';
import { ScreenState } from '@/components/ScreenState';
import { Radius, Spacing, type ThemeColors, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';
import { useSpeechStore } from '@/state/speechStore';
import { blocksToUtterances } from '@/utils/blocksToUtterances';
import { translationFeedbackMailto } from '@/utils/feedback';

export default function PostScreen() {
  const {
    id,
    title,
    sourceName,
    url,
    isBookmarked: initialIsBookmarked,
  } = useLocalSearchParams<{
    id: string;
    title?: string;
    sourceName?: string;
    url: string;
    isBookmarked?: string;
  }>();
  const strings = useStrings();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const language = useLanguageStore((state) => state.language);
  const [viewLang, setViewLang] = useState<Language>(language);
  // Route params are a one-time navigation snapshot (D25) — they never
  // update, so a confirmed bookmark toggle would otherwise revert once
  // BookmarkButton clears its transient optimistic overlay and display falls
  // back to this stale value. The feed's BottomActionBar doesn't need this:
  // its `isBookmarked` comes from the live, patched `['feed']` query cache.
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked === 'true');

  const contentQuery = useQuery({
    queryKey: ['content', id, viewLang],
    queryFn: () => fetchPostContent(id, viewLang),
    // A 402 (D69's reader-opens quota) means "go to the paywall", not a
    // transient failure worth TanStack Query's default retry.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 402) && failureCount < 3,
  });
  const content = contentQuery.data;
  const isQuotaExceeded =
    contentQuery.error instanceof ApiError && contentQuery.error.status === 402;

  const isSpeakingThisArticle = useSpeechStore((state) => state.isSpeaking(id));
  const isSpeechLanguageAvailable = useSpeechStore((state) =>
    content?.available === true ? state.isLanguageAvailable(content.lang) : false,
  );

  useEffect(() => {
    useSpeechStore.getState().checkVoiceAvailability();
  }, []);

  // The displayed text just changed out from under any in-flight speech —
  // stop rather than keep reading the language the user just switched away
  // from. viewLang is a deliberate trigger-only dependency: the effect
  // re-runs on every toggle even though its body doesn't read the value.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  useEffect(() => {
    useSpeechStore.getState().stop();
  }, [viewLang]);

  // Kill switch / content-level generation failures (D23), and the rare case
  // a just-ingested post's eager compact job hasn't finished yet (D36), all
  // come back as `available: false` — this reads as "routes straight to the
  // browser" from the user's perspective.
  useEffect(() => {
    if (content && content.available === false) {
      WebBrowser.openBrowserAsync(url);
      router.back();
    }
  }, [content, url]);

  // D69: reader-opens quota exhausted (402) routes to the paywall instead of
  // the generic error state — `replace`, not `push`, so the paywall's own
  // back button returns to the feed, not to this now-unusable reader.
  useEffect(() => {
    if (isQuotaExceeded) {
      router.replace('/paywall');
    }
  }, [isQuotaExceeded]);

  const openOriginal = () => WebBrowser.openBrowserAsync(url);
  // Android ignores `url` (iOS-only field), so the link must ride in `message`
  // or the share intent goes out empty (see BottomActionBar).
  const share = () =>
    Share.share({
      title,
      url,
      message: Platform.OS === 'android' ? (title ? `${title}\n${url}` : url) : title,
    });

  if (contentQuery.isPending || content?.available === false || isQuotaExceeded) {
    return <ScreenState loading spinnerColor={colors.primary} caption={strings.reader.loading} />;
  }

  if (!content || contentQuery.isError || content.available !== true) {
    return (
      <ScreenState
        message={strings.reader.error}
        retryLabel={strings.reader.readOriginal}
        onRetry={openOriginal}
      />
    );
  }

  const canToggleLanguage = language !== 'en';
  const isViewingTranslation = content.lang !== 'en';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="reader-screen"
    >
      <TouchableRipple
        style={styles.header}
        onLongPress={
          isViewingTranslation
            ? () => Linking.openURL(translationFeedbackMailto(id, content.lang))
            : undefined
        }
      >
        {/* biome-ignore lint/complexity/noUselessFragments: TouchableRipple calls React.Children.only, so multiple children need a single wrapping element. */}
        <>
          {sourceName ? <Text style={styles.sourceName}>{sourceName}</Text> : null}
          {canToggleLanguage ? (
            <Button
              mode="text"
              compact
              labelStyle={styles.toggleText}
              onPress={() => setViewLang((current) => (current === 'en' ? language : 'en'))}
            >
              {viewLang === 'en' ? strings.reader.showTranslated : strings.reader.showOriginal}
            </Button>
          ) : null}
        </>
      </TouchableRipple>

      {content.blocks.map((block, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocks are a static list returned whole per request, never reordered/filtered client-side.
        <ReaderBlock key={index} block={block} figures={content.figures} styles={styles} />
      ))}

      <View style={styles.actions}>
        <Button mode="contained" onPress={openOriginal}>
          {strings.reader.readOriginal}
        </Button>
        <BookmarkButton
          postId={id}
          isBookmarked={isBookmarked}
          iconColor={colors.text}
          testID="reader-bookmark"
          snapshot={title && sourceName ? { cardTitle: title, sourceName, url } : undefined}
          onToggled={setIsBookmarked}
        />
        <IconButton
          icon="share-variant"
          iconColor={colors.text}
          onPress={share}
          accessibilityLabel={strings.a11y.share}
        />
        {isSpeechLanguageAvailable ? (
          <IconButton
            icon={isSpeakingThisArticle ? 'volume-off' : 'volume-high'}
            iconColor={colors.text}
            accessibilityLabel={
              isSpeakingThisArticle ? strings.speech.stopListening : strings.speech.listen
            }
            onPress={() => {
              const speech = useSpeechStore.getState();
              if (isSpeakingThisArticle) {
                speech.stop();
              } else {
                speech.speak(id, blocksToUtterances(content.blocks, content.figures), content.lang);
              }
            }}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

interface ReaderBlockProps {
  block: CompactBlock;
  figures: CompactFigure[];
  styles: ReturnType<typeof createStyles>;
}

function ReaderBlock({ block, figures, styles }: ReaderBlockProps) {
  switch (block.type) {
    case 'heading':
      return <Text style={styles.heading}>{block.text}</Text>;
    case 'paragraph':
      return <Text style={styles.paragraph}>{block.text}</Text>;
    case 'quote':
      return <Text style={styles.quote}>{block.text}</Text>;
    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: list items are a static list returned whole per request, never reordered/filtered client-side.
            <Text key={index} style={styles.listItem}>
              {'•'} {item}
            </Text>
          ))}
        </View>
      );
    case 'image': {
      const figure = figures[block.figureIndex];
      if (!figure) return null;
      return (
        <View style={styles.figure}>
          <Image source={{ uri: figure.url }} style={styles.figureImage} contentFit="cover" />
          {figure.caption ? <Text style={styles.figureCaption}>{figure.caption}</Text> : null}
        </View>
      );
    }
    default:
      return null;
  }
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
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.four,
    },
    sourceName: {
      color: colors.textSecondary,
      ...Typography.sm,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    toggleText: {
      color: colors.primary,
      ...Typography.sm,
      fontWeight: '600',
    },
    heading: {
      color: colors.text,
      ...Typography.lg,
      fontWeight: '700',
      marginTop: Spacing.three,
      marginBottom: Spacing.two,
    },
    paragraph: {
      color: colors.text,
      ...Typography.md,
      marginBottom: Spacing.three,
    },
    quote: {
      color: colors.textSecondary,
      ...Typography.md,
      fontStyle: 'italic',
      borderLeftColor: colors.primary,
      borderLeftWidth: 2,
      paddingLeft: Spacing.three,
      marginBottom: Spacing.three,
    },
    list: {
      marginBottom: Spacing.three,
    },
    listItem: {
      color: colors.text,
      ...Typography.md,
      marginBottom: Spacing.one,
    },
    figure: {
      marginBottom: Spacing.three,
    },
    figureImage: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: Radius.md,
    },
    figureCaption: {
      color: colors.textSecondary,
      ...Typography.sm,
      marginTop: Spacing.one,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      marginTop: Spacing.four,
    },
  });
}
