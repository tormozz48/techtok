import { useQuery } from '@tanstack/react-query';
import type { CompactBlock, CompactFigure, Language } from '@techtok/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getPostContent } from '@/api/client';
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

  const { data, isLoading, isError } = useQuery({
    queryKey: ['content', id, viewLang],
    queryFn: () => getPostContent(id, viewLang),
  });

  // Kill switch / over-cap / content-level generation failures (D23) all
  // come back as `available: false` — this reads as "routes straight to the
  // browser" from the user's perspective, with only a brief spinner flash.
  useEffect(() => {
    if (data && !data.available) {
      WebBrowser.openBrowserAsync(url);
      router.back();
    }
  }, [data, url]);

  const openOriginal = () => WebBrowser.openBrowserAsync(url);
  const share = () => Share.share({ url, title });

  if (isLoading || (data && !data.available)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.dark.text} size="large" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{strings.reader.error}</Text>
        <Pressable style={styles.ctaButton} onPress={openOriginal}>
          <Text style={styles.ctaButtonText}>{strings.reader.readOriginal}</Text>
        </Pressable>
      </View>
    );
  }

  const canToggleLanguage = language !== 'en';
  const isViewingTranslation = data.lang !== 'en';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable
        style={styles.header}
        onLongPress={
          isViewingTranslation
            ? () => Linking.openURL(translationFeedbackMailto(id, data.lang))
            : undefined
        }
      >
        {sourceName ? <Text style={styles.sourceName}>{sourceName}</Text> : null}
        {canToggleLanguage ? (
          <Pressable onPress={() => setViewLang((current) => (current === 'en' ? language : 'en'))}>
            <Text style={styles.toggleText}>
              {viewLang === 'en' ? strings.reader.showTranslated : strings.reader.showOriginal}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>

      {data.blocks.map((block, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocks are a static list returned whole per request, never reordered/filtered client-side.
        <ReaderBlock key={index} block={block} figures={data.figures} />
      ))}

      <View style={styles.actions}>
        <Pressable style={styles.ctaButton} onPress={openOriginal}>
          <Text style={styles.ctaButtonText}>{strings.reader.readOriginal}</Text>
        </Pressable>
        <Pressable style={styles.shareButton} hitSlop={8} onPress={share}>
          <Text style={styles.shareIcon}>↗</Text>
        </Pressable>
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
  ctaButton: {
    backgroundColor: Colors.overlay.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  ctaButtonText: {
    color: Colors.overlay.surfaceBlack,
    ...Typography.md,
    fontWeight: '700',
  },
  shareButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIcon: {
    fontSize: 20,
    color: Colors.dark.text,
  },
});
