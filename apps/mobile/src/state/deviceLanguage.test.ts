import * as Localization from 'expo-localization';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectDeviceLanguage, detectDeviceTimezone } from './deviceLanguage';

function mockLocales(locales: Array<{ languageCode: string }>) {
  // biome-ignore lint/suspicious/noExplicitAny: real Locale has ~13 required fields we don't need here.
  vi.spyOn(Localization, 'getLocales').mockReturnValue(locales as any);
}

describe('detectDeviceLanguage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the device language when it is supported', () => {
    mockLocales([{ languageCode: 'ru' }]);
    expect(detectDeviceLanguage()).toBe('ru');
  });

  it('returns undefined when the device language is not supported', () => {
    mockLocales([{ languageCode: 'fr' }]);
    expect(detectDeviceLanguage()).toBeUndefined();
  });

  it('returns undefined when there are no locales', () => {
    mockLocales([]);
    expect(detectDeviceLanguage()).toBeUndefined();
  });
});

describe('detectDeviceTimezone', () => {
  it('returns a non-empty IANA-shaped timezone string from the JS runtime', () => {
    const tz = detectDeviceTimezone();
    expect(typeof tz).toBe('string');
    expect(tz?.length).toBeGreaterThan(0);
  });

  it('returns undefined if Intl.DateTimeFormat throws', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(detectDeviceTimezone()).toBeUndefined();
    spy.mockRestore();
  });
});
