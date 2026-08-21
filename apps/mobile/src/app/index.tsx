import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import type { Card as CardData } from '@techtok/shared';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
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
import { formatResetTime } from '@/utils/formatResetTime';

export default function FeedScreen() {
  const {
    data,
    dataUpdatedAt,
    isLoading,
    isError,
    isFetching,
    refetch,
    fetchNextPage,
    isFetchingNextPage,
  } = useFeedQuery();
  const entitlementQuery = useEntitlementQuery();
  const isRestoring = useIsRestoring();
  const [activeCard, setActiveCard] = useState<CardData | undefined>(undefined);
  const strings = useStrings();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  // Distinguishes cards this mount actually fetched from cards restored out
  // of the persisted query cache (_layout.tsx dehydrates ['feed'] for
  // offline use), whose dataUpdatedAt predates the mount — see the gate
  // below. Lazy initializer so it's the mount time, not the last render's.
  const [mountedAt] = useState(() => Date.now());

  const cards = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  // D69's client-side gate reads the *live* entitlement first, and only falls
  // back to the feed page's own `quotaExhausted` flag. Reading that flag
  // alone was the bug: it can only appear on a page fetched *after* the limit
  // was hit, and pages are only fetched from `onNearEnd` (within
  // NEAR_END_THRESHOLD of the buffer's end) — so a user who spent their last
  // card mid-buffer kept swiping the whole remaining page, and the persisted
  // ['feed'] cache (_layout.tsx) carried that buffer across restarts. The
  // entitlement query is invalidated on every read flush (api/client.ts), so
  // this flips within one flush interval of the read that spent the quota.
  // The page flag still covers the cold-start window before ['entitlement']
  // resolves, and offline (where neither query can refresh) remains D69's
  // knowingly-accepted hole.
  const entitlement = entitlementQuery.data;
  const lastPage = data?.pages.at(-1);
  const isQuotaExhausted =
    (entitlement?.plan === 'free' &&
      entitlement.quota.cardReads >= entitlement.quota.cardReadsLimit) ||
    lastPage?.quotaExhausted === true;
  const quotaResetsAt = entitlement?.quota.resetsAt ?? lastPage?.resetsAt;

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
  // Reads the *last* page (the shared `lastPage` above) for the same reason
  // the quota fallback does: it's the freshest read of what the server just
  // rendered.
  const serverLanguage = lastPage?.language;
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

  // A cold start restores the persisted feed and paints it instantly, then —
  // the restored pages being older than FEED_STALE_TIME_MS — replaces every
  // card once the mount refetch lands a round-trip later. Card is keyed by
  // card.id, so a wholesale replacement unmounts the touchable the user is
  // mid-press on, and Pressability cancels a press whose target unmounts:
  // the tap is silently swallowed, which is the "first posts aren't
  // clickable until you swipe a few times" report (D80). So hold the
  // existing LoadingScreen until the cards on screen are ones this mount
  // fetched, and paint exactly one card set.
  //
  // Scoped to pre-first-fetch data on purpose: once a fetch from this mount
  // has landed, dataUpdatedAt stays ahead of mountedAt, so later fetches
  // (fetchNextPage, A1's focus refetch) never blank the feed. And a *failed*
  // refetch clears isFetching without advancing dataUpdatedAt, so an offline
  // cold start falls through to the restored cards instead of hanging here.
  const isShowingPreMountData = dataUpdatedAt < mountedAt;
  if (isLoading || isRestoring || (isShowingPreMountData && isFetching)) {
    return <LoadingScreen />;
  }

  // Blocks in place rather than routing to /paywall (which is what this used
  // to do): a pushed route leaves the feed mounted underneath, so one back
  // press returned the user to a fully swipeable over-limit feed — and the
  // old one-shot ref guarding that push never re-armed, so it stayed
  // swipeable for the rest of the session. There is nothing to dismiss here,
  // and it re-renders from the same gate after any remount. Checked before
  // `isError`/`cards.length === 0` so an exhausted user sees the limit rather
  // than a retry button or an empty-feed message. The action bar stays so
  // saved/history/settings are still reachable.
  if (isQuotaExhausted) {
    return (
      <View style={styles.root} testID="feed-quota-exhausted">
        <ScreenState
          title={strings.paywall.quotaExhaustedTitle}
          message={
            quotaResetsAt
              ? strings.paywall.quotaExhaustedMessage(formatResetTime(quotaResetsAt))
              : undefined
          }
          retryLabel={strings.quota.upgradeCta}
          onRetry={() => router.push('/paywall')}
          retryTestID="feed-quota-upgrade"
        />
        <BottomActionBar
          activeCard={undefined}
          // Also refreshes the entitlement, not just the feed — after a local
          // midnight rollover that counter is the only thing standing between
          // the user and a usable feed again.
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ['entitlement'] });
            queryClient.resetQueries({ queryKey: ['feed'] });
          }}
        />
      </View>
    );
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
        // No quota branch here any more — an exhausted quota never reaches
        // this render path, and a `quotaExhausted` page reports
        // `nextBefore: null`, so `fetchNextPage` is already a no-op.
        onNearEnd={() => {
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
