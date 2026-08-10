import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuthStore } from './authStore';

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

beforeAll(() => {
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
});

afterAll(() => {
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = ORIGINAL_ENV;
});

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ status: 'loading', user: null });
});

describe('authStore.restore', () => {
  it('goes straight to signedOut when there is no previous sign-in', async () => {
    (GoogleSignin.hasPreviousSignIn as jest.Mock).mockReturnValue(false);

    await useAuthStore.getState().restore();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', user: null });
    expect(GoogleSignin.signInSilently).not.toHaveBeenCalled();
  });

  it('restores a signed-in session silently when one exists', async () => {
    (GoogleSignin.hasPreviousSignIn as jest.Mock).mockReturnValue(true);
    (GoogleSignin.signInSilently as jest.Mock).mockResolvedValue({
      type: 'success',
      data: { idToken: 'tok-1', user: { email: 'a@example.com', name: 'Ada' } },
    });

    await useAuthStore.getState().restore();

    expect(useAuthStore.getState()).toMatchObject({
      status: 'signedIn',
      user: { idToken: 'tok-1', email: 'a@example.com', name: 'Ada' },
    });
  });

  it('falls back to signedOut when silent sign-in finds no saved credential', async () => {
    (GoogleSignin.hasPreviousSignIn as jest.Mock).mockReturnValue(true);
    (GoogleSignin.signInSilently as jest.Mock).mockResolvedValue({
      type: 'noSavedCredentialFound',
      data: null,
    });

    await useAuthStore.getState().restore();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', user: null });
  });

  it('falls back to signedOut when silent sign-in throws', async () => {
    (GoogleSignin.hasPreviousSignIn as jest.Mock).mockReturnValue(true);
    (GoogleSignin.signInSilently as jest.Mock).mockRejectedValue(new Error('network'));

    await useAuthStore.getState().restore();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', user: null });
  });
});

describe('authStore.signIn', () => {
  it('signs in and stores the user on success', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      type: 'success',
      data: { idToken: 'tok-2', user: { email: 'b@example.com', name: 'Bea' } },
    });

    await useAuthStore.getState().signIn();

    expect(useAuthStore.getState()).toMatchObject({
      status: 'signedIn',
      user: { idToken: 'tok-2', email: 'b@example.com', name: 'Bea' },
    });
  });

  it('leaves the store unchanged when the user cancels the sign-in sheet', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'cancelled', data: null });

    await useAuthStore.getState().signIn();

    expect(useAuthStore.getState()).toMatchObject({ status: 'loading', user: null });
  });
});

describe('authStore.signOut', () => {
  it('clears the session', async () => {
    useAuthStore.setState({ status: 'signedIn', user: { idToken: 'x', email: null, name: null } });

    await useAuthStore.getState().signOut();

    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', user: null });
  });
});

describe('authStore.refreshToken', () => {
  it('returns a fresh id token and updates the store on success', async () => {
    (GoogleSignin.signInSilently as jest.Mock).mockResolvedValue({
      type: 'success',
      data: { idToken: 'tok-3', user: { email: 'c@example.com', name: 'Cy' } },
    });

    const token = await useAuthStore.getState().refreshToken();

    expect(token).toBe('tok-3');
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('returns null and signs the store out when there is no saved credential', async () => {
    (GoogleSignin.signInSilently as jest.Mock).mockResolvedValue({
      type: 'noSavedCredentialFound',
      data: null,
    });

    const token = await useAuthStore.getState().refreshToken();

    expect(token).toBeNull();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', user: null });
  });

  it('returns null and signs the store out when the silent refresh throws', async () => {
    (GoogleSignin.signInSilently as jest.Mock).mockRejectedValue(new Error('expired'));

    const token = await useAuthStore.getState().refreshToken();

    expect(token).toBeNull();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', user: null });
  });
});

describe('authStore configuration', () => {
  it('throws a clear error when EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set', async () => {
    // A fresh module instance is required: the real `useAuthStore` module
    // memoizes `GoogleSignin.configure()` behind a module-level flag once
    // any earlier test in this file has configured it successfully.
    let isolatedStore: typeof import('./authStore').useAuthStore | undefined;
    jest.isolateModules(() => {
      isolatedStore = (require('./authStore') as typeof import('./authStore')).useAuthStore;
    });

    const original = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    // `process.env.X = undefined` stringifies to "undefined" (truthy) rather
    // than deleting the key — `delete` is required to actually unset it.
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

    await expect(isolatedStore?.getState().signIn()).rejects.toThrow(
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set',
    );

    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = original;
  });
});
