import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import type { Card as CardData } from '@techtok/shared';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useEntitlementQuery } from '@/api/useEntitlementQuery';
import { useFeedQuery } from '@/api/useFeedQuery';
import { BottomActionBar } from '@/components/BottomActionBar';
import { FeedPager } from '@/components/FeedPager';
import { LoadingScreen } from '@/components/LoadingScreen';
import { QuotaBadge } from '@/components/QuotaBadge';
import { ScreenState } from '@/components/ScreenState';
import { Colors, Spacing } from '@/constants/theme';
import { useQuotaReset } from '@/hooks/useQuotaReset';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';

export default function FeedScreen() {
  const { data, isLoading, isError, refetch, fetchNextPage, isFetchingNextPage } = useFeedQuery();
  const entitlementQuery = useEntitlementQuery();
  const isRestoring = useIsRestoring();
  const [activeCard, setActiveCard] = useState<CardData | undefined>(undefined);
  const strings = useStrings();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  // Guards against re-navigating to /paywall on every subsequent onNearEnd
  // call while the user keeps swiping through already-cached cards.
  const hasPromptedPaywall = useRef(false);

  const cards = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  // D69: the *last* fetched page, not any page, since only the newest tells
  // us today's cardReads quota is actually exhausted right now.
  const isQuotaExhausted = data?.pages.at(-1)?.quotaExhausted === true;

  // A brand-new fetch (no cards cached yet — e.g. a fresh install already at
  // the daily limit from another device) has nothing to swipe through at
  // all, so go straight to the paywall instead of showing an empty feed.
  // `push`, not `replace`: the paywall must always have the feed underneath
  // it (the same invariant the reader's own 402 path keeps) or there is no
  // route back at all, and the only escape is relaunching the app.
  useEffect(() => {
    if (isQuotaExhausted && cards.length === 0 && !hasPromptedPaywall.current) {
      hasPromptedPaywall.current = true;
      router.push('/paywall');
    }
  }, [isQuotaExhausted, cards.length]);

  // Re-arm once the quota recovers, so a later exhaustion prompts again
  // instead of silently dead-ending `onNearEnd` for the rest of this mount.
  useEffect(() => {
    if (!isQuotaExhausted) hasPromptedPaywall.current = false;
  }, [isQuotaExhausted]);

  // D69's counters roll over server-side at the user's local midnight, but
  // both of this screen's views of them are pre-boundary snapshots: the
  // cached feed page's `quotaExhausted` flag, and the badge's entitlement
  // counts. Drop them at the boundary instead of waiting for a foreground
  // event or a relaunch to happen to refetch.
  useQuotaReset(entitlementQuery.data?.quota.resetsAt, () => {
    entitlementQuery.refetch();
    // Only an exhausted page needs dropping — resetting an otherwise healthy
    // feed would flash a loading screen at midnight for someone mid-swipe.
    if (isQuotaExhausted) queryClient.resetQueries({ queryKey: ['feed'] });
  });

  // D79: the server is the source of truth for the account's language
  // (Users.language) — this is the one reconciliation channel that can't be
  // skipped, since the feed fetches on every launch, unlike languageStore's
  // own load() (a separate GET /v1/me a warm app resume never re-runs).
  // Reads the *last* page like isQuotaExhausted above, for the same reason:
  // it's the freshest read of what the server just rendered.
  const serverLanguage = data?.pages.at(-1)?.language;
  useEffect(() => {
    if (serverLanguage) useLanguageStore.getState().adoptServerLanguage(serverLanguage);
  }, [serverLanguage]);

  // Keeps the action bar's per-card actions in sync with the visible card
  // without waiting for a swipe: seeds activeCard on first load, and
  // re-seeds it if the feed is fully replaced (e.g. a topic/language change)
  // while the old activeCard no longer exists in the new set. Also re-points
  // to the refreshed object for the same id on every `cards` update (not just
  // when the id disappears) — otherwise a refetch triggered by a bookmark
  // toggle never reaches the action bar, since the id itself doesn't change,
  // and the bookmark icon reverts to its pre-toggle state once the optimistic
  // overlay clears.
  useEffect(() => {
    setActiveCard((current) => {
      if (cards.length === 0) return undefined;
      if (!current) return cards[0];
      return cards.find((card) => card.id === current.id) ?? cards[0];
    });
  }, [cards]);

  if (isLoading || isRestoring) {
    return <LoadingScreen />;
  }

  if (isError) {
    return (
      <View style={styles.root} testID="feed-error">
        <ScreenState
          message={strings.feed.error}
          messageColor={colors.error}
          retryLabel={strings.feed.retry}
          onRetry={() => refetch()}
          retryTestID="feed-retry"
        />
        <BottomActionBar
          activeCard={undefined}
          onRefresh={() => queryClient.resetQueries({ queryKey: ['feed'] })}
        />
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.root} testID="feed-empty">
        <ScreenState message={strings.feed.empty} />
        <BottomActionBar
          activeCard={undefined}
          onRefresh={() => queryClient.resetQueries({ queryKey: ['feed'] })}
        />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="feed-screen">
      {/* The feed itself is always a full-bleed dark photo overlay (Card.tsx,
       * scheme-independent) with light text, so it needs light status-bar
       * icons regardless of the device's theme — unlike the plain chrome
       * states above, which inherit _layout.tsx's theme-following default. */}
      <StatusBar style="light" />
      <FeedPager
        cards={cards}
        onPageChange={setActiveCard}
        onNearEnd={() => {
          if (isQuotaExhausted) {
            if (!hasPromptedPaywall.current) {
              hasPromptedPaywall.current = true;
              router.push('/paywall');
            }
            return;
          }
          if (!isFetchingNextPage) fetchNextPage();
        }}
      />
      {isFetchingNextPage ? (
        <View style={styles.fetchingIndicator} pointerEvents="none">
          <ActivityIndicator color={Colors.overlay.text} size="small" />
        </View>
      ) : null}
      {entitlementQuery.data?.plan === 'free' ? (
        <View style={styles.quotaBadge} pointerEvents="none" testID="quota-badge">
          <QuotaBadge
            used={entitlementQuery.data.quota.cardReads}
            limit={entitlementQuery.data.quota.cardReadsLimit}
          />
          {/* Surfaced alongside cardReads (D69) so the reader-opens cap is
           * visible before it's hit, instead of only discovered as a 402
           * mid-tap — reuses the same free-plan gate. */}
          <QuotaBadge
            used={entitlementQuery.data.quota.readerOpens}
            limit={entitlementQuery.data.quota.readerOpensLimit}
            label={strings.quota.readerOpensLabel}
          />
        </View>
      ) : null}
      <BottomActionBar
        activeCard={activeCard ?? cards[0]}
        onRefresh={() => queryClient.resetQueries({ queryKey: ['feed'] })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fetchingIndicator: {
    position: 'absolute',
    top: Spacing.six,
    alignSelf: 'center',
  },
  quotaBadge: {
    position: 'absolute',
    top: Spacing.six,
    right: Spacing.three,
    gap: Spacing.half,
    alignItems: 'flex-end',
  },
});
