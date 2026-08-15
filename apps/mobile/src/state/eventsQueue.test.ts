import { postEvents } from '@/api/client';
import { flushEventsQueue, logError, logEvent } from './eventsQueue';
import { storage } from './storage';

jest.mock('@/api/client', () => ({
  postEvents: jest.fn(),
}));

const mockPostEvents = postEvents as jest.MockedFunction<typeof postEvents>;

beforeEach(() => {
  storage.clearAll();
  mockPostEvents.mockReset();
});

describe('logEvent / logError', () => {
  it('does not send anything until flushed', () => {
    logEvent('card_settled', { postId: 'post-1' });
    expect(mockPostEvents).not.toHaveBeenCalled();
  });
});

describe('flushEventsQueue', () => {
  it('does nothing when the queue is empty', async () => {
    await flushEventsQueue();
    expect(mockPostEvents).not.toHaveBeenCalled();
  });

  it('sends queued records and clears the queue on success', async () => {
    mockPostEvents.mockResolvedValue(undefined);
    logEvent('card_settled', { postId: 'post-1' });
    logError('feed fetch failed', { status: 500 });

    await flushEventsQueue();
    await flushEventsQueue();

    expect(mockPostEvents).toHaveBeenCalledTimes(1);
    expect(mockPostEvents).toHaveBeenCalledWith([
      expect.objectContaining({ kind: 'event', name: 'card_settled' }),
      expect.objectContaining({ kind: 'log', level: 'error', message: 'feed fetch failed' }),
    ]);
  });

  it('keeps the queue for the next attempt when the request fails', async () => {
    mockPostEvents.mockRejectedValueOnce(new Error('network down'));
    logEvent('card_settled', { postId: 'post-1' });

    await flushEventsQueue();

    mockPostEvents.mockResolvedValueOnce(undefined);
    await flushEventsQueue();

    expect(mockPostEvents).toHaveBeenCalledTimes(2);
  });
});
