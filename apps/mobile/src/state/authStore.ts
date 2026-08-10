import {
  GoogleSignin,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import { create } from 'zustand';

export interface AuthUser {
  readonly idToken: string;
  readonly email: string | null;
  readonly name: string | null;
}

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: AuthUser | null;
  /** Attempts to restore a previous session with no user interaction — call
   * once at app start, before rendering the `/auth` gate. Google Sign-In's
   * SDK persists its own session (Credential Manager on Android), so there
   * is nothing for this app to cache across restarts beyond calling this. */
  restore: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-authenticates silently to obtain a fresh ID token — Google ID tokens
   * expire in ~1h (D68), so the API client calls this once on a 401 before
   * retrying. Returns null if the silent refresh itself fails, in which case
   * the caller should treat the session as signed out. */
  refreshToken: () => Promise<string | null>;
}

/**
 * Google Sign-In web client ID (D68) — public by design (it's baked into
 * the shipped APK and sent on every sign-in request, unlike an API key), so
 * a plain `EXPO_PUBLIC_*` build-time var is the right home for it, same as
 * `EXPO_PUBLIC_API_URL` in `api/client.ts`. Copy `.env.example` to `.env`
 * and set it to the "Web application" OAuth client ID from Google Cloud
 * Console (see infra/auth.ts for the matching server-side audience). Read
 * lazily (not a module-level const) so it reflects `process.env` at call
 * time rather than at first import.
 */
function requireWebClientId(): string {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. Copy .env.example to .env and set it to the Google OAuth "Web application" client ID.',
    );
  }
  return webClientId;
}

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  // offlineAccess/webClientId (not iosClientId) is what makes signIn()
  // return a Google *ID token* (a verifiable JWT) rather than just an
  // opaque access token — the server's JWT authorizer (infra/api.ts) needs
  // the former.
  GoogleSignin.configure({ webClientId: requireWebClientId() });
  configured = true;
}

function toAuthUser(
  idToken: string | null,
  user: { email: string; name: string | null },
): AuthUser {
  if (!idToken) {
    throw new Error(
      'Google Sign-In returned no ID token — check that GoogleSignin.configure() was called with webClientId, not just iosClientId.',
    );
  }
  return { idToken, email: user.email, name: user.name };
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  restore: async () => {
    ensureConfigured();
    if (!GoogleSignin.hasPreviousSignIn()) {
      set({ status: 'signedOut', user: null });
      return;
    }
    try {
      const response = await GoogleSignin.signInSilently();
      if (isNoSavedCredentialFoundResponse(response)) {
        set({ status: 'signedOut', user: null });
        return;
      }
      set({ status: 'signedIn', user: toAuthUser(response.data.idToken, response.data.user) });
    } catch {
      set({ status: 'signedOut', user: null });
    }
  },

  signIn: async () => {
    ensureConfigured();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return; // user cancelled — stay signedOut
    set({ status: 'signedIn', user: toAuthUser(response.data.idToken, response.data.user) });
  },

  signOut: async () => {
    ensureConfigured();
    await GoogleSignin.signOut();
    set({ status: 'signedOut', user: null });
  },

  refreshToken: async () => {
    ensureConfigured();
    try {
      const response = await GoogleSignin.signInSilently();
      if (isNoSavedCredentialFoundResponse(response)) {
        set({ status: 'signedOut', user: null });
        return null;
      }
      const user = toAuthUser(response.data.idToken, response.data.user);
      set({ status: 'signedIn', user });
      return user.idToken;
    } catch {
      set({ status: 'signedOut', user: null });
      return null;
    }
  },
}));
