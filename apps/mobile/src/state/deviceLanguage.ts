import { isLanguage, type Language } from '@techtok/shared';
import * as Localization from 'expo-localization';

/** Best-effort device locale (D20), sent as the `X-Device-Language` header
 * so the server can default a brand-new user's language on first sight.
 * Returns undefined for anything outside the supported set — the server
 * falls back to `en` itself. */
export function detectDeviceLanguage(): Language | undefined {
  const code = Localization.getLocales()[0]?.languageCode;
  return code && isLanguage(code) ? code : undefined;
}
