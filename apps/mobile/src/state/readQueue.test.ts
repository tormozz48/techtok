import { postReads } from '@/api/client';
import { enqueueRead, flushReadQueue } from './readQueue';
import { storage } from './storage';

jest.mock('@/api/client', () => ({
  postReads: jest.fn(),
}));

const mockPostReads = postReads as jest.MockedFunction<typeof postReads>;

beforeEach(() => {
  storage.clearAll();
  mockPostReads.mockReset();
});

describe('enqueueRead', () => {
  it('does not send anything until flushed', () => {
    enqueueRead('post-1');
    expect(mockPostReads).not.toHaveBeenCalled();
  });

  it('dedups repeated enqueues of the same postId', async () => {
    mockPostReads.mockResolvedValue(undefined);
    enqueueRead('post-1');
    enqueueRead('post-1');

    await flushReadQueue();

    expect(mockPostReads).toHaveBeenCalledTimes(1);
    expect(mockPostReads).toHaveBeenCalledWith(['post-1']);
  });
});

describe('flushReadQueue', () => {
  it('does nothing when the queue is empty', async () => {
    await flushReadQueue();
    expect(mockPostReads).not.toHaveBeenCalled();
  });

  it('sends queued postIds and clears the queue on success', async () => {
    mockPostReads.mockResolvedValue(undefined);
    enqueueRead('post-1');
    enqueueRead('post-2');

    await flushReadQueue();
    await flushReadQueue();

    expect(mockPostReads).toHaveBeenCalledTimes(1);
    expect(mockPostReads).toHaveBeenCalledWith(['post-1', 'post-2']);
  });

  it('keeps the queue for the next attempt when the request fails', async () => {
    mockPostReads.mockRejectedValueOnce(new Error('network down'));
    enqueueRead('post-1');

    await flushReadQueue();

    mockPostReads.mockResolvedValueOnce(undefined);
    await flushReadQueue();

    expect(mockPostReads).toHaveBeenCalledTimes(2);
    expect(mockPostReads).toHaveBeenLastCalledWith(['post-1']);
  });

  it('does not drop reads enqueued while a flush is in flight', async () => {
    let resolvePost: () => void = () => {};
    mockPostReads.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = () => resolve(undefined);
        }),
    );
    enqueueRead('post-1');

    const flushing = flushReadQueue();
    enqueueRead('post-2');
    resolvePost();
    await flushing;

    mockPostReads.mockResolvedValueOnce(undefined);
    await flushReadQueue();

    expect(mockPostReads).toHaveBeenLastCalledWith(['post-2']);
  });
});
