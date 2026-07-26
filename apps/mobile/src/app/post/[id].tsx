import { useQuery } from '@tanstack/react-query';
import type { CompactBlock, CompactFigure, Language } from '@techtok/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, TouchableRipple } from 'react-native-paper';
import { fetchPostContent } from '@/api/client';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';
import { translationFeedbackMailto } from '@/utils/feedback';

export default function PostScreen() {
  const { id, title, sourceName, url } = useLocalSearchParams<{
    id: string;
    title?: string;
    sourceName?: string;
    url: string;
  }>();
  const strings = useStrings();
  const language = useLanguageStore((state) => state.language);
  const [viewLang, setViewLang] = useState<Language>(language);

  const contentQuery = useQuery({
    queryKey: ['content', id, viewLang],
    queryFn: () => fetchPostContent(id, viewLang),
  });
  const content = contentQuery.data;

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

  const openOriginal = () => WebBrowser.openBrowserAsync(url);
  // Android ignores `url` (iOS-only field), so the link must ride in `message`
  // or the share intent goes out empty (see BottomActionBar).
  const share = () =>
    Share.share({
      title,
      url,
      message: Platform.OS === 'android' ? (title ? `${title}\n${url}` : url) : title,
    });

  if (contentQuery.isPending || content?.available === false) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.overlay.accent} />
        <Text style={styles.stageText}>{strings.reader.loading}</Text>
      </View>
    );
  }

  if (!content || contentQuery.isError || content.available !== true) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{strings.reader.error}</Text>
        <Button mode="contained" onPress={openOriginal}>
          {strings.reader.readOriginal}
        </Button>
      </View>
    );
  }

  const canToggleLanguage = language !== 'en';
  const isViewingTranslation = content.lang !== 'en';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
        <ReaderBlock key={index} block={block} figures={content.figures} />
      ))}

      <View style={styles.actions}>
        <Button mode="contained" onPress={openOriginal}>
          {strings.reader.readOriginal}
        </Button>
        <IconButton
          icon="share-variant"
          iconColor={Colors.dark.text}
          onPress={share}
          accessibilityLabel={strings.a11y.share}
        />
      </View>
    </ScrollView>
  );
}

function ReaderBlock({ block, figures }: { block: CompactBlock; figures: CompactFigure[] }) {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  errorText: {
    color: Colors.dark.textSecondary,
    ...Typography.md,
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  stageText: {
    color: Colors.dark.textSecondary,
    ...Typography.sm,
    marginTop: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  sourceName: {
    color: Colors.dark.textSecondary,
    ...Typography.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleText: {
    color: Colors.overlay.accent,
    ...Typography.sm,
    fontWeight: '600',
  },
  heading: {
    color: Colors.dark.text,
    ...Typography.lg,
    fontWeight: '700',
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  paragraph: {
    color: Colors.dark.text,
    ...Typography.md,
    marginBottom: Spacing.three,
  },
  quote: {
    color: Colors.dark.textSecondary,
    ...Typography.md,
    fontStyle: 'italic',
    borderLeftColor: Colors.overlay.accent,
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    marginBottom: Spacing.three,
  },
  list: {
    marginBottom: Spacing.three,
  },
  listItem: {
    color: Colors.dark.text,
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
    color: Colors.dark.textSecondary,
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
