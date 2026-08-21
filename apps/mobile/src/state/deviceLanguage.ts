import { isLanguage, type Language } from '@techtok/shared';
import * as Localization from 'expo-localization';

export function detectDeviceLanguage(): Language | undefined {
  const code = Localization.getLocales()[0]?.languageCode;
  return code && isLanguage(code) ? code : undefined;
}

export function detectDeviceTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
