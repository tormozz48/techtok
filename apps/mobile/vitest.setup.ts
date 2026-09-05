import { randomUUID as nodeRandomUUID } from 'node:crypto';
import { vi } from 'vitest';

const MOCK_GOOGLE_USER = {
  idToken: 'mock-id-token',
  user: { email: 'mock@example.com', name: 'Mock User' },
};

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
      getAllKeys: vi.fn(async () => [...store.keys()]),
      multiGet: vi.fn(async (keys: string[]) => keys.map((key) => [key, store.get(key) ?? null])),
      multiRemove: vi.fn(async (keys: string[]) => {
        for (const key of keys) store.delete(key);
      }),
    },
  };
});

vi.mock('@sentry/react-native', () => ({
  reactNavigationIntegration: vi.fn(() => ({})),
  init: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  wrap: vi.fn((component: unknown) => component),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => nodeRandomUUID()),
}));

vi.mock('expo-localization', () => ({
  getLocales: vi.fn(() => [{ languageCode: 'en' }]),
}));

vi.mock('expo-speech', () => ({
  speak: vi.fn(),
  stop: vi.fn().mockResolvedValue(undefined),
  isSpeakingAsync: vi.fn().mockResolvedValue(false),
  getAvailableVoicesAsync: vi.fn().mockResolvedValue([]),
}));

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    hasPreviousSignIn: vi.fn().mockReturnValue(false),
    signIn: vi.fn().mockResolvedValue({ type: 'success', data: MOCK_GOOGLE_USER }),
    signInSilently: vi.fn().mockResolvedValue({ type: 'success', data: MOCK_GOOGLE_USER }),
    signOut: vi.fn().mockResolvedValue(null),
    getCurrentUser: vi.fn().mockReturnValue(null),
  },
  isSuccessResponse: (response: { type: string }) => response.type === 'success',
  isNoSavedCredentialFoundResponse: (response: { type: string }) =>
    response.type === 'noSavedCredentialFound',
  isCancelledResponse: (response: { type: string }) => response.type === 'cancelled',
}));
