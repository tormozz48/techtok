// Manual mock, same convention as the sibling expo-* mocks in this
// directory. Not the package's own (unexported) internal jest helper —
// `@react-native-google-signin/google-signin`'s package.json `exports` map
// doesn't expose a `./jest` subpath, so depending on its internal file path
// would be fragile across upgrades. Response shapes here mirror the real
// `SignInSuccessResponse`/`NoSavedCredentialFound` union the library returns.

export const mockUser = {
  idToken: 'mock-id-token',
  user: { email: 'mock@example.com', name: 'Mock User' },
};

export const GoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn().mockResolvedValue(true),
  hasPreviousSignIn: jest.fn().mockReturnValue(false),
  signIn: jest.fn().mockResolvedValue({ type: 'success', data: mockUser }),
  signInSilently: jest.fn().mockResolvedValue({ type: 'success', data: mockUser }),
  signOut: jest.fn().mockResolvedValue(null),
  getCurrentUser: jest.fn().mockReturnValue(null),
};

export function isSuccessResponse(response: { type: string }): boolean {
  return response.type === 'success';
}

export function isNoSavedCredentialFoundResponse(response: { type: string }): boolean {
  return response.type === 'noSavedCredentialFound';
}

export function isCancelledResponse(response: { type: string }): boolean {
  return response.type === 'cancelled';
}
