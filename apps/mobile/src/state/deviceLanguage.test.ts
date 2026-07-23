import * as Localization from 'expo-localization';
import { detectDeviceLanguage } from './deviceLanguage';

function mockLocales(locales: Array<{ languageCode: string }>) {
  // biome-ignore lint/suspicious/noExplicitAny: real Locale has ~13 required fields we don't need here.
  jest.spyOn(Localization, 'getLocales').mockReturnValue(locales as any);
}

describe('detectDeviceLanguage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
