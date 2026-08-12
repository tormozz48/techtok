// Manual mock, same convention as the sibling expo-* mocks in this
// directory. Response shapes here mirror the real `OneTapResponse` union
// (`success` | `noSavedCredentialFound` | `cancelled`) the package returns.

export const mockUser = {
  idToken: 'mock-id-token',
  user: { email: 'mock@example.com', name: 'Mock User' },
};

export const GoogleOneTapSignIn = {
  configure: jest.fn(),
  checkPlayServices: jest.fn().mockResolvedValue(undefined),
  signIn: jest.fn().mockResolvedValue({ type: 'success', data: mockUser }),
  presentExplicitSignIn: jest.fn().mockResolvedValue({ type: 'success', data: mockUser }),
  createAccount: jest.fn().mockResolvedValue({ type: 'success', data: mockUser }),
  signOut: jest.fn().mockResolvedValue(undefined),
  getCurrentUser: jest.fn().mockReturnValue(null),
};

export function isSuccessResponse(response: { type: string; data: unknown }): boolean {
  return response.type === 'success' && response.data != null;
}

export function isNoSavedCredentialFoundResponse(response: { type: string }): boolean {
  return response.type === 'noSavedCredentialFound';
}

export function isCancelledResponse(response: { type: string }): boolean {
  return response.type === 'cancelled';
}
