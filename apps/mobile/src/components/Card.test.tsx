import type { Card as CardData } from '@techtok/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { STRINGS } from '@/i18n/strings';
import { enqueueRead } from '@/state/readQueue';
import { translationFeedbackMailto } from '@/utils/feedback';
import { Card } from './Card';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));
jest.mock('@/state/readQueue', () => ({
  enqueueRead: jest.fn(),
}));

const routerPushMock = router.push as jest.Mock;
const enqueueReadMock = enqueueRead as jest.Mock;
const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

const BASE_CARD: CardData = {
  id: 'post-1',
  title: 'Researchers Ship a New Model That Actually Fits on a Phone',
  summary: 'A distillation technique cuts model size by 80% while keeping most accuracy.',
  sourceName: 'TechCrunch',
  url: 'https://example.com/article',
  primaryTopic: 'ai',
  topics: ['ai'],
  publishedAt: '2026-07-20T12:00:00.000Z',
  servedLang: 'en',
  isTranslated: false,
  compactLangs: [],
};

beforeEach(() => {
  routerPushMock.mockReset();
  enqueueReadMock.mockReset();
  openURLSpy.mockClear();
});

describe('Card', () => {
  it('renders title, summary, and source name', async () => {
    await render(<Card card={BASE_CARD} />);
    expect(screen.getByText(BASE_CARD.title)).toBeTruthy();
    expect(screen.getByText(BASE_CARD.summary)).toBeTruthy();
    expect(screen.getByText(BASE_CARD.sourceName)).toBeTruthy();
  });

  it('does not show the translated badge for an original-language card', async () => {
    await render(<Card card={BASE_CARD} />);
    expect(screen.queryByText(STRINGS.en.card.translatedBadge)).toBeNull();
  });

  it('shows the translated badge for a translated card', async () => {
    await render(<Card card={{ ...BASE_CARD, isTranslated: true }} />);
    expect(screen.getByText(STRINGS.en.card.translatedBadge)).toBeTruthy();
  });

  it('does not show a source-count line by default', async () => {
    await render(<Card card={BASE_CARD} />);
    expect(screen.queryByText(STRINGS.en.card.sourceCount(3))).toBeNull();
  });

  it('shows the source-count line when sourceCount is set', async () => {
    await render(<Card card={{ ...BASE_CARD, sourceCount: 3 }} />);
    expect(screen.getByText(STRINGS.en.card.sourceCount(3))).toBeTruthy();
  });

  it('enqueues the read and navigates to the reader on press', async () => {
    await render(<Card card={BASE_CARD} />);

    await fireEvent.press(screen.getByText(BASE_CARD.title));

    expect(enqueueReadMock).toHaveBeenCalledWith('post-1');
    expect(routerPushMock).toHaveBeenCalledWith({
      pathname: '/post/[id]',
      params: {
        id: 'post-1',
        title: BASE_CARD.title,
        sourceName: BASE_CARD.sourceName,
        url: BASE_CARD.url,
        isBookmarked: 'false',
      },
    });
  });

  it('opens the translation-feedback mailto link on long-press instead of navigating', async () => {
    const translated: CardData = { ...BASE_CARD, isTranslated: true, servedLang: 'ru' };
    await render(<Card card={translated} />);

    await fireEvent(screen.getByText(BASE_CARD.title), 'longPress');

    expect(openURLSpy).toHaveBeenCalledWith(translationFeedbackMailto('post-1', 'ru'));
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it('does not respond to long-press on a non-translated card', async () => {
    await render(<Card card={BASE_CARD} />);

    await fireEvent(screen.getByText(BASE_CARD.title), 'longPress');

    expect(openURLSpy).not.toHaveBeenCalled();
  });

  it('still navigates on a normal press after a long-press elsewhere (no tap-eating latch)', async () => {
    const translated: CardData = { ...BASE_CARD, isTranslated: true, servedLang: 'ru' };
    await render(<Card card={translated} />);

    await fireEvent(screen.getByText(BASE_CARD.title), 'longPress');
    await fireEvent.press(screen.getByText(BASE_CARD.title));

    expect(routerPushMock).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ id: 'post-1' }) }),
    );
  });
});
