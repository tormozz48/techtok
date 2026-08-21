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
import { hasQuotaResetPassed } from '@/utils/quotaReset';

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
  const [mountedAt] = useState(() => Date.now());

  const cards = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const entitlement = entitlementQuery.data;
  const lastPage = data?.pages.at(-1);
  const isExpiredQuotaPage =
    lastPage?.quotaExhausted === true && hasQuotaResetPassed(lastPage.resetsAt);
  const isQuotaExhausted =
    (entitlement?.plan === 'free' &&
      entitlement.quota.cardReads >= entitlement.quota.cardReadsLimit) ||
    (lastPage?.quotaExhausted === true && !isExpiredQuotaPage);
  const quotaResetsAt = entitlement?.quota.resetsAt ?? lastPage?.resetsAt;

  useEffect(() => {
    if (isExpiredQuotaPage) queryClient.resetQueries({ queryKey: ['feed'] });
  }, [isExpiredQuotaPage, queryClient]);

  useQuotaReset(entitlementQuery.data?.quota.resetsAt, () => {
    entitlementQuery.refetch();
    if (isQuotaExhausted) queryClient.resetQueries({ queryKey: ['feed'] });
  });

  const serverLanguage = lastPage?.language;
  useEffect(() => {
    if (serverLanguage) useLanguageStore.getState().adoptServerLanguage(serverLanguage);
  }, [serverLanguage]);

  useEffect(() => {
    setActiveCard((current) => {
      if (cards.length === 0) return undefined;
      if (!current) return cards[0];
      return cards.find((card) => card.id === current.id) ?? cards[0];
    });
  }, [cards]);

  const isShowingPreMountData = dataUpdatedAt < mountedAt;
  if (isLoading || isRestoring || (isShowingPreMountData && isFetching)) {
    return <LoadingScreen />;
  }

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
      <StatusBar style="light" />
      <FeedPager
        cards={cards}
        onPageChange={setActiveCard}
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
