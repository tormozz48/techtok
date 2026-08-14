/**
 * Build-time flag for the Maestro emulator suite's sign-in bypass
 * (`packages/e2e/maestro`).
 *
 * Every screen is gated behind Google Sign-In (D68), and Google deliberately
 * blocks automating its consent UI, so an emulator suite that drives the real
 * flow cannot reach any screen at all. Instead the harness mints a real Google
 * ID token for the dedicated test account — the same `GOOGLE_TEST_REFRESH_TOKEN`
 * exchange the HTTP-level suites already use (`packages/e2e/src/googleTestAuth.ts`)
 * — and hands it to the app over a `techtok://auth?idToken=...` deep link, which
 * `app/auth.tsx` installs as the active session.
 *
 * This is not a privilege escalation. The API's JWT authorizer (`infra/api.ts`)
 * still verifies every token on every request, so the bypass only skips the UI
 * step of *obtaining* a token the caller must already hold — it grants no access
 * a normal sign-in wouldn't. It is nonetheless gated behind a build-time flag
 * that no shipping profile sets: Metro inlines `process.env.EXPO_PUBLIC_*` at
 * bundle time, so in any build that doesn't set it this compares `undefined`
 * against `'1'` and the whole branch is dead-code-eliminated out of the APK.
 *
 * Set only by `packages/e2e/scripts/buildE2eApk.sh`. Never set it in
 * `eas.json`, `apps/mobile/.env`, or CI's production deploy.
 */
export function isE2eAuthEnabled(): boolean {
  return process.env.EXPO_PUBLIC_E2E_AUTH === '1';
}
