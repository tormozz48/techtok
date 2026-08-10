// Google OAuth "Web" client ID (D68) — the `audience` the JWT authorizer
// checks on every token, and the `webClientId` the native Google Sign-In SDK
// needs to request an ID token (not just an access token) on Android. This
// is NOT a secret: an OAuth client ID is public by design (it's baked into
// the shipped APK and sent on every sign-in request) — it lives as a plain
// per-stage env var, the same pattern as BEDROCK_MODEL_ID/OPENROUTER_MODEL_ID
// in infra/pipeline.ts, not an sst.Secret.
//
// Maintainer setup (one-time, per Google Cloud project): create an OAuth
// consent screen, then two OAuth client IDs — "Web application" (this
// value) and "Android" (package `com.tormozz48dev.techtok` + the SHA-1 of
// **both** the local debug keystore and, once Play App Signing is enabled,
// the Play-managed release certificate — Play rewrites the signing cert, so
// the locally-held upload key's SHA-1 alone is not enough for a Play-signed
// build to authenticate, see DESIGN §11). Set via
// `GOOGLE_OAUTH_WEB_CLIENT_ID=... sst deploy --stage <stage>` until this has
// a permanent home in stage config.
export const GOOGLE_OAUTH_WEB_CLIENT_ID =
  process.env.GOOGLE_OAUTH_WEB_CLIENT_ID ?? 'REPLACE_ME.apps.googleusercontent.com';
