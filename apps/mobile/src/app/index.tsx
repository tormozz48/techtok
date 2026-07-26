import { useQueryClient } from '@tanstack/react-query';
import type { Card as CardData } from '@techtok/shared';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFeedQuery } from '@/api/useFeedQuery';
import { BottomActionBar } from '@/components/BottomActionBar';
import { FeedPager } from '@/components/FeedPager';
import { LoadingScreen } from '@/components/LoadingScreen';
import type { ThemeColors } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';

export default function FeedScreen() {
  const { data, isLoading, isError, error, fetchNextPage, isFetchingNextPage } = useFeedQuery();
  const [activeCard, setActiveCard] = useState<CardData | undefined>(undefined);
  const strings = useStrings();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const cards = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : strings.feed.error}
        </Text>
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{strings.feed.empty}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* The feed itself is always a full-bleed dark photo overlay (Card.tsx,
       * scheme-independent) with light text, so it needs light status-bar
       * icons regardless of the device's theme — unlike the plain chrome
       * states above, which inherit _layout.tsx's theme-following default. */}
      <StatusBar style="light" />
      <FeedPager
        cards={cards}
        onPageChange={setActiveCard}
        onNearEnd={() => {
          if (!isFetchingNextPage) fetchNextPage();
        }}
      />
      <BottomActionBar
        activeCard={activeCard ?? cards[0]}
        onRefresh={() => queryClient.resetQueries({ queryKey: ['feed'], exact: true })}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    errorText: {
      color: colors.error,
      textAlign: 'center',
      fontSize: 16,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      fontSize: 16,
    },
    root: {
      flex: 1,
    },
  });
}
