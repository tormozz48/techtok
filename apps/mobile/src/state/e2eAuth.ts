export function isE2eAuthEnabled(): boolean {
  return process.env.EXPO_PUBLIC_E2E_AUTH === '1';
}
