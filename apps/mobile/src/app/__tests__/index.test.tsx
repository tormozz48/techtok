import type { Card as CardData, EntitlementResponse, FeedResponse } from '@techtok/shared';
import { screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FeedScreen from '@/app/index';
import {
  createTestQueryClient,
  renderWithQueryClient,
  resetSharedStores,
} from '@/testing/renderWithProviders';

jest.mock('@/state/readQueue', () => ({ enqueueRead: jest.fn() }));
jest.mock('@/state/network', () => ({ getIsWifi: jest.fn(() => false) }));

function card(id: string): CardData {
  return {
    id,
    title: `Title ${id}`,
    summary: 'Summary.',
    sourceName: 'TechCrunch',
    url: `https://example.com/${id}`,
    primaryTopic: 'ai',
    topics: ['ai'],
    publishedAt: '2026-07-20T12:00:00.000Z',
    servedLang: 'en',
    isTranslated: false,
    compactLangs: [],
  };
}

function freeQuota(overrides: Partial<EntitlementResponse['quota']> = {}) {
  return {
    cardReads: 4,
    cardReadsLimit: 100,
    readerOpens: 1,
    readerOpensLimit: 20,
    resetsAt: '2026-07-21T00:00:00.000Z',
    ...overrides,
  };
}

// BottomActionBar reads useSafeAreaInsets(), which throws with no provider
// above it -- fixed metrics rather than the device's, so insets never vary.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function withSafeArea(ui: ReactElement) {
  return <SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>;
}

function renderFeed(feed: FeedResponse, entitlement?: EntitlementResponse) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(['feed', 'en'], { pages: [feed], pageParams: [undefined] });
  if (entitlement) queryClient.setQueryData(['entitlement'], entitlement);
  return renderWithQueryClient(withSafeArea(<FeedScreen />), queryClient);
}

beforeEach(() => {
  resetSharedStores();
});

describe('FeedScreen quota gate (D69)', () => {
  it('renders the feed while the daily card-reads quota still has room', async () => {
    await renderFeed(
      { items: [card('a'), card('b')], nextBefore: null },
      {
        plan: 'free',
        quota: freeQuota(),
      },
    );

    expect(screen.getByTestId('feed-screen')).toBeTruthy();
    expect(screen.queryByTestId('feed-quota-exhausted')).toBeNull();
  });

  // The regression this gate was rewritten for: the buffer is still full of
  // swipeable cards and the page carries no `quotaExhausted` flag (it was
  // fetched while still under the limit), so the old page-flag-only gate let
  // the user keep swiping every cached card.
  it('blocks in place once the live entitlement says card-reads are spent', async () => {
    await renderFeed(
      { items: [card('a'), card('b')], nextBefore: null },
      {
        plan: 'free',
        quota: freeQuota({ cardReads: 100 }),
      },
    );

    expect(screen.getByTestId('feed-quota-exhausted')).toBeTruthy();
    expect(screen.queryByTestId('feed-screen')).toBeNull();
  });

  it('still blocks on the feed page flag before the entitlement query resolves', async () => {
    await renderFeed({ items: [], nextBefore: null, quotaExhausted: true });

    expect(screen.getByTestId('feed-quota-exhausted')).toBeTruthy();
    expect(screen.queryByTestId('feed-empty')).toBeNull();
  });

  it('never blocks a plus subscriber', async () => {
    await renderFeed(
      { items: [card('a')], nextBefore: null },
      {
        plan: 'plus',
        quota: freeQuota({ cardReads: 5_000 }),
      },
    );

    expect(screen.getByTestId('feed-screen')).toBeTruthy();
    expect(screen.queryByTestId('feed-quota-exhausted')).toBeNull();
  });
});
