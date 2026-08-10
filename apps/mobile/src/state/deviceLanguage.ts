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

/** Device IANA timezone (D68/D69), sent as `X-Device-Timezone` so the server
 * can seed a brand-new user's quota-reset timezone at sign-in — same
 * first-touch-only contract as the language header above. Hermes has had
 * full `Intl` support since RN 0.71, so this never needs a native module. */
export function detectDeviceTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
