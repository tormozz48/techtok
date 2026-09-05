import { LANGUAGES } from '@techtok/shared';
import { describe, expect, it } from 'vitest';
import { toSpeechLanguageCode } from './speechLanguage';

describe('toSpeechLanguageCode', () => {
  it('maps every supported language to a BCP 47 tag', () => {
    expect(toSpeechLanguageCode('en')).toBe('en-US');
    expect(toSpeechLanguageCode('ru')).toBe('ru-RU');
    expect(toSpeechLanguageCode('uk')).toBe('uk-UA');
    expect(toSpeechLanguageCode('pl')).toBe('pl-PL');
  });

  it('covers every language in the shared LANGUAGES list', () => {
    for (const language of LANGUAGES) {
      expect(() => toSpeechLanguageCode(language)).not.toThrow();
      expect(toSpeechLanguageCode(language)).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });
});
