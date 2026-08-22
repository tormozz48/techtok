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
