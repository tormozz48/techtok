import type { Card as CardData } from '@techtok/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useHapticsStore } from '@/state/hapticsStore';
import { getIsWifi } from '@/state/network';
import { enqueueRead } from '@/state/readQueue';
import { createTestQueryClient, renderWithQueryClient } from '@/testing/renderWithProviders';
import { FeedPager } from './FeedPager';

jest.mock('@/state/readQueue', () => ({
  enqueueRead: jest.fn(),
}));
jest.mock('@/state/network', () => ({
  getIsWifi: jest.fn(() => false),
}));
// expo-haptics isn't part of jest-expo's default auto-mock set (unlike
// expo-speech) -- impactAsync needs an explicit mock; ImpactFeedbackStyle
// is kept real since it's just a plain enum-like object.
jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  impactAsync: jest.fn(),
}));

const enqueueReadMock = enqueueRead as jest.Mock;
const getIsWifiMock = getIsWifi as jest.Mock;
const impactAsyncMock = Haptics.impactAsync as jest.Mock;
const prefetchSpy = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);

function card(id: string, overrides: Partial<CardData> = {}): CardData {
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
    ...overrides,
  };
}

function selectPage(position: number) {
  // screen.root is nullable in general, but a successful render always has
  // one -- a missing root would already surface as a different failure.
  return fireEvent(screen.root as NonNullable<typeof screen.root>, 'pageSelected', {
    nativeEvent: { position },
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  enqueueReadMock.mockReset();
  getIsWifiMock.mockReset().mockReturnValue(false);
  impactAsyncMock.mockReset().mockResolvedValue(undefined);
  useHapticsStore.setState({ enabled: true });
  prefetchSpy.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('FeedPager', () => {
  it('renders a Card per item', async () => {
    await renderWithQueryClient(<FeedPager cards={[card('post-1', { title: 'First card' })]} />);
    expect(screen.getByText('First card')).toBeTruthy();
  });

  it('reports the newly-active card on page settle', async () => {
    const onPageChange = jest.fn();
    const cards = [card('post-1'), card('post-2')];
    await renderWithQueryClient(<FeedPager cards={cards} onPageChange={onPageChange} />);

    await selectPage(1);

    expect(onPageChange).toHaveBeenCalledWith(cards[1]);
  });

  it('enqueues a read and fires haptics after the settle delay', async () => {
    const cards = [card('post-1'), card('post-2')];
    await renderWithQueryClient(<FeedPager cards={cards} />);

    await selectPage(1);
    expect(enqueueReadMock).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1500);

    expect(enqueueReadMock).toHaveBeenCalledWith('post-2');
    expect(impactAsyncMock).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('skips the haptic but still enqueues the read when vibration is switched off', async () => {
    useHapticsStore.setState({ enabled: false });
    const cards = [card('post-1'), card('post-2')];
    await renderWithQueryClient(<FeedPager cards={cards} />);

    await selectPage(1);
    await jest.advanceTimersByTimeAsync(1500);

    expect(enqueueReadMock).toHaveBeenCalledWith('post-2');
    expect(impactAsyncMock).not.toHaveBeenCalled();
  });

  it('picks up a mid-wait switch flip, since the setting is read when the timer fires', async () => {
    const cards = [card('post-1'), card('post-2')];
    await renderWithQueryClient(<FeedPager cards={cards} />);

    await selectPage(1);
    useHapticsStore.setState({ enabled: false });
    await jest.advanceTimersByTimeAsync(1500);

    expect(impactAsyncMock).not.toHaveBeenCalled();
  });

  it('cancels the pending settle when the page changes again before the delay elapses', async () => {
    const cards = [card('post-1'), card('post-2'), card('post-3')];
    await renderWithQueryClient(<FeedPager cards={cards} />);

    await selectPage(1);
    await jest.advanceTimersByTimeAsync(500);
    await selectPage(2);
    await jest.advanceTimersByTimeAsync(1500);

    expect(enqueueReadMock).toHaveBeenCalledTimes(1);
    expect(enqueueReadMock).toHaveBeenCalledWith('post-3');
  });

  it('calls onNearEnd once within the near-end threshold of the last card', async () => {
    const onNearEnd = jest.fn();
    const cards = Array.from({ length: 6 }, (_, i) => card(`post-${i}`));
    await renderWithQueryClient(<FeedPager cards={cards} onNearEnd={onNearEnd} />);

    await selectPage(0);
    expect(onNearEnd).not.toHaveBeenCalled();

    await selectPage(1);
    expect(onNearEnd).toHaveBeenCalledTimes(1);
  });

  it('prefetches images over wifi but not otherwise', async () => {
    const cards = [card('post-1'), card('post-2', { imageUrl: 'https://example.com/2.jpg' })];

    getIsWifiMock.mockReturnValue(false);
    await renderWithQueryClient(<FeedPager cards={cards} />);
    await selectPage(1);
    expect(prefetchSpy).not.toHaveBeenCalled();

    getIsWifiMock.mockReturnValue(true);
    await selectPage(0);
    await selectPage(1);
    expect(prefetchSpy).toHaveBeenCalled();
  });

  it("never warms the reader's content cache on scroll (D82)", async () => {
    const cards = [card('post-1'), card('post-2'), card('post-3')];
    const queryClient = createTestQueryClient();

    getIsWifiMock.mockReturnValue(true);
    await renderWithQueryClient(<FeedPager cards={cards} />, queryClient);
    await selectPage(0);
    await selectPage(1);

    expect(queryClient.getQueryCache().findAll({ queryKey: ['content'] })).toEqual([]);
  });
});
