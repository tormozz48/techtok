import * as Speech from 'expo-speech';
import { beforeEach, describe, expect, it, type Mock } from 'vitest';
import { useSpeechStore } from './speechStore';

const speakMock = Speech.speak as Mock;
const stopMock = Speech.stop as Mock;
const getAvailableVoicesAsyncMock = Speech.getAvailableVoicesAsync as Mock;

beforeEach(() => {
  speakMock.mockClear();
  stopMock.mockClear();
  getAvailableVoicesAsyncMock.mockClear().mockResolvedValue([]);
  useSpeechStore.setState({ speakingId: null, availableLanguages: null });
});

describe('speechStore.speak', () => {
  it('stops any prior speech before starting', () => {
    useSpeechStore.getState().speak('post-1', ['Hello'], 'en');
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('speaks each non-empty text in order with the mapped language code', () => {
    useSpeechStore.getState().speak('post-1', ['Title.', 'Summary.'], 'ru');

    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(speakMock.mock.calls[0]?.[0]).toBe('Title.');
    expect(speakMock.mock.calls[0]?.[1]).toMatchObject({ language: 'ru-RU' });
    expect(speakMock.mock.calls[1]?.[0]).toBe('Summary.');
  });

  it('tags speakingId with the given id when given at least one speakable text', () => {
    useSpeechStore.getState().speak('post-1', ['Hello'], 'en');
    expect(useSpeechStore.getState().speakingId).toBe('post-1');
    expect(useSpeechStore.getState().isSpeaking('post-1')).toBe(true);
    expect(useSpeechStore.getState().isSpeaking('post-2')).toBe(false);
  });

  it('filters out blank/whitespace-only strings before speaking', () => {
    useSpeechStore.getState().speak('post-1', ['', '   ', 'Real text'], 'en');
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0]?.[0]).toBe('Real text');
  });

  it('does nothing (no speakingId set) when every text is blank', () => {
    useSpeechStore.getState().speak('post-1', ['', '  '], 'en');
    expect(speakMock).not.toHaveBeenCalled();
    expect(useSpeechStore.getState().speakingId).toBeNull();
  });

  it('only attaches onDone/onError to the last utterance in a sequence', () => {
    useSpeechStore.getState().speak('post-1', ['First', 'Second', 'Third'], 'en');

    const [firstOpts, secondOpts, thirdOpts] = speakMock.mock.calls.map((call) => call[1]);
    expect(firstOpts.onDone).toBeUndefined();
    expect(secondOpts.onDone).toBeUndefined();
    expect(thirdOpts.onDone).toBeInstanceOf(Function);
    expect(thirdOpts.onError).toBeInstanceOf(Function);
  });

  it('clears speakingId only once the last utterance in a sequence finishes', () => {
    useSpeechStore.getState().speak('post-1', ['First', 'Second'], 'en');
    const [, secondOpts] = speakMock.mock.calls.map((call) => call[1]);

    expect(useSpeechStore.getState().speakingId).toBe('post-1');
    secondOpts.onDone();
    expect(useSpeechStore.getState().speakingId).toBeNull();
  });

  it('attaches onStopped to every utterance so a mid-sequence stop always resets speakingId', () => {
    useSpeechStore.getState().speak('post-1', ['First', 'Second'], 'en');
    const [firstOpts] = speakMock.mock.calls.map((call) => call[1]);

    firstOpts.onStopped();
    expect(useSpeechStore.getState().speakingId).toBeNull();
  });

  it('switching to a different id correctly reports the old id as no longer speaking', () => {
    useSpeechStore.getState().speak('post-1', ['First'], 'en');
    useSpeechStore.getState().speak('post-2', ['Second'], 'en');

    expect(useSpeechStore.getState().isSpeaking('post-1')).toBe(false);
    expect(useSpeechStore.getState().isSpeaking('post-2')).toBe(true);
  });
});

describe('speechStore.stop', () => {
  it('calls Speech.stop and clears speakingId', () => {
    useSpeechStore.setState({ speakingId: 'post-1' });

    useSpeechStore.getState().stop();

    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(useSpeechStore.getState().speakingId).toBeNull();
  });
});

describe('speechStore.isLanguageAvailable', () => {
  it('is optimistic (true) before checkVoiceAvailability has resolved', () => {
    expect(useSpeechStore.getState().isLanguageAvailable('ru')).toBe(true);
  });

  it('reflects the checked voice list once populated', async () => {
    getAvailableVoicesAsyncMock.mockResolvedValue([{ language: 'en-US', identifier: 'x' }]);

    await useSpeechStore.getState().checkVoiceAvailability();

    expect(useSpeechStore.getState().isLanguageAvailable('en')).toBe(true);
    expect(useSpeechStore.getState().isLanguageAvailable('ru')).toBe(false);
  });

  it('only checks once — a second call is a no-op', async () => {
    getAvailableVoicesAsyncMock.mockResolvedValue([{ language: 'en-US', identifier: 'x' }]);
    await useSpeechStore.getState().checkVoiceAvailability();
    getAvailableVoicesAsyncMock.mockClear();

    await useSpeechStore.getState().checkVoiceAvailability();

    expect(getAvailableVoicesAsyncMock).not.toHaveBeenCalled();
  });

  it('leaves availability unset (optimistic) when the check itself fails', async () => {
    getAvailableVoicesAsyncMock.mockRejectedValue(new Error('platform API unavailable'));

    await useSpeechStore.getState().checkVoiceAvailability();

    expect(useSpeechStore.getState().availableLanguages).toBeNull();
    expect(useSpeechStore.getState().isLanguageAvailable('ru')).toBe(true);
  });
});
