import type { Card as CardData } from '@techtok/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { Share } from 'react-native';
import { STRINGS } from '@/i18n/strings';
import {
  createTestQueryClient,
  renderWithQueryClient,
  resetSharedStores,
} from '@/testing/renderWithProviders';
import { BottomActionBar } from './BottomActionBar';

jest.mock('@/api/client', () => ({
  createBookmark: jest.fn(),
  deleteBookmark: jest.fn(),
  fetchMe: jest.fn(),
  putLanguage: jest.fn(),
}));
jest.mock('@/api/prefetchContent', () => ({
  prefetchPostContent: jest.fn(),
}));
jest.mock('@/state/network', () => ({
  getIsWifi: jest.fn(() => false),
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const a11y = STRINGS.en.a11y;
const speechStrings = STRINGS.en.speech;

const ACTIVE_CARD: CardData = {
  id: 'post-1',
  title: 'A Headline',
  summary: 'A summary.',
  sourceName: 'TechCrunch',
  url: 'https://example.com/article',
  primaryTopic: 'ai',
  topics: ['ai'],
  publishedAt: '2026-07-20T12:00:00.000Z',
  servedLang: 'en',
  isTranslated: false,
  compactLangs: [],
};

const getAvailableVoicesAsyncMock = Speech.getAvailableVoicesAsync as jest.Mock;
const speakMock = Speech.speak as jest.Mock;
const stopMock = Speech.stop as jest.Mock;
const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });

let queryClient: ReturnType<typeof createTestQueryClient>;

beforeEach(() => {
  resetSharedStores();
  getAvailableVoicesAsyncMock
    .mockReset()
    .mockResolvedValue([{ language: 'en-US', identifier: 'x' }]);
  speakMock.mockReset();
  stopMock.mockReset();
  shareSpy.mockClear();
  queryClient = createTestQueryClient();
});

afterEach(() => {
  queryClient.clear();
  queryClient.unmount();
});

describe('BottomActionBar', () => {
  it('shows only the global nav buttons when there is no active card', async () => {
    await renderWithQueryClient(
      <BottomActionBar activeCard={undefined} onRefresh={jest.fn()} />,
      queryClient,
    );
    expect(screen.queryByLabelText(a11y.share)).toBeNull();
    expect(screen.getByLabelText(a11y.openSaved)).toBeTruthy();
    expect(screen.getByLabelText(a11y.openHistory)).toBeTruthy();
    expect(screen.getByLabelText(a11y.openSettings)).toBeTruthy();
  });

  it('shows the share button and a bookmark toggle when there is an active card', async () => {
    await renderWithQueryClient(
      <BottomActionBar activeCard={ACTIVE_CARD} onRefresh={jest.fn()} />,
      queryClient,
    );
    expect(screen.getByLabelText(a11y.share)).toBeTruthy();
    expect(screen.getByLabelText(a11y.bookmarkAdd)).toBeTruthy();
  });

  it('calls onRefresh when the refresh button is pressed', async () => {
    const onRefresh = jest.fn();
    await renderWithQueryClient(
      <BottomActionBar activeCard={undefined} onRefresh={onRefresh} />,
      queryClient,
    );

    await fireEvent.press(screen.getByLabelText('Refresh feed'));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shares the active card when the share button is pressed', async () => {
    await renderWithQueryClient(
      <BottomActionBar activeCard={ACTIVE_CARD} onRefresh={jest.fn()} />,
      queryClient,
    );

    await fireEvent.press(screen.getByLabelText(a11y.share));

    expect(shareSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: ACTIVE_CARD.title, url: ACTIVE_CARD.url }),
    );
  });

  it('hides the listen button when the card language has no available voice', async () => {
    getAvailableVoicesAsyncMock.mockResolvedValue([{ language: 'fr-FR', identifier: 'x' }]);
    await renderWithQueryClient(
      <BottomActionBar activeCard={ACTIVE_CARD} onRefresh={jest.fn()} />,
      queryClient,
    );

    await screen.findByLabelText(a11y.share);
    expect(screen.queryByLabelText(speechStrings.listen)).toBeNull();
  });

  it('speaks the card on listen press, then stops on a second press', async () => {
    await renderWithQueryClient(
      <BottomActionBar activeCard={ACTIVE_CARD} onRefresh={jest.fn()} />,
      queryClient,
    );

    const listenButton = await screen.findByLabelText(speechStrings.listen);
    await fireEvent.press(listenButton);

    expect(speakMock).toHaveBeenCalledWith(
      ACTIVE_CARD.title,
      expect.objectContaining({ language: 'en-US' }),
    );

    stopMock.mockClear();
    const stopButton = await screen.findByLabelText(speechStrings.stopListening);
    await fireEvent.press(stopButton);

    expect(stopMock).toHaveBeenCalledTimes(1);
  });
});
