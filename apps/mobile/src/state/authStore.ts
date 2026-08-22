import {
  GoogleSignin,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import { create } from 'zustand';
import { isE2eAuthEnabled } from './e2eAuth';

export interface AuthUser {
  readonly idToken: string;
  readonly email: string | null;
  readonly name: string | null;
}

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: AuthUser | null;
  restore: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signInWithIdToken: (idToken: string) => void;
  refreshToken: () => Promise<string | null>;
}

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

let silentSignInAttempt: Promise<AuthUser | null> | null = null;

function silentSignIn(): Promise<AuthUser | null> {
  silentSignInAttempt ??= attemptSilentSignIn().finally(() => {
    silentSignInAttempt = null;
  });
  return silentSignInAttempt;
}

async function attemptSilentSignIn(): Promise<AuthUser | null> {
  try {
    ensureConfigured();
    const response = await GoogleSignin.signInSilently();
    if (isNoSavedCredentialFoundResponse(response)) return null;
    return toAuthUser(response.data.idToken, response.data.user);
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,

  restore: async () => {
    if (isE2eAuthEnabled()) {
      set({ status: 'signedOut', user: null });
      return;
    }
    try {
      ensureConfigured();
      if (!GoogleSignin.hasPreviousSignIn()) {
        set({ status: 'signedOut', user: null });
        return;
      }
    } catch {
      set({ status: 'signedOut', user: null });
      return;
    }
    const user = await silentSignIn();
    set(user ? { status: 'signedIn', user } : { status: 'signedOut', user: null });
  },

  signIn: async () => {
    ensureConfigured();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return;
    set({ status: 'signedIn', user: toAuthUser(response.data.idToken, response.data.user) });
  },

  signInWithIdToken: (idToken: string) => {
    if (!isE2eAuthEnabled()) return;
    set({
      status: 'signedIn',
      user: { idToken, email: null, name: null },
    });
  },

  signOut: async () => {
    if (isE2eAuthEnabled()) {
      set({ status: 'signedOut', user: null });
      return;
    }
    ensureConfigured();
    await GoogleSignin.signOut();
    set({ status: 'signedOut', user: null });
  },

  refreshToken: async () => {
    if (isE2eAuthEnabled()) return get().user?.idToken ?? null;
    const user = await silentSignIn();
    if (!user) {
      set({ status: 'signedOut', user: null });
      return null;
    }
    set({ status: 'signedIn', user });
    return user.idToken;
  },
}));
