# Distributing TechTok to friends (Phase 5)

TechTok is distributed as an installable Android APK via EAS internal
distribution — no Play Store listing, no review process. This is a one-time
per-maintainer setup, then a link you can send.

## One-time setup (maintainer)

1. `npx eas login` (creates/uses an Expo account — free tier is enough).
2. From `apps/mobile/`, run `npx eas init` to link the project; this writes a
   real `projectId` into `app.json` under `expo.extra.eas`.
3. Get the deployed production API URL (`aws apigatewayv2 get-apis --region
   eu-central-1 --query "Items[?Name=='techtok-production-Api'].ApiEndpoint"`
   or read it from the `sst deploy --stage production` CI log), then replace
   `REPLACE_WITH_PRODUCTION_API_URL` in both the `preview` and `production`
   profiles of `apps/mobile/eas.json`.

## Building an install link

```
cd apps/mobile
npx eas build --platform android --profile preview
```

This uploads a build to Expo's servers and prints a page URL
(`https://expo.dev/accounts/<you>/projects/techtok/builds/<id>`) — that page
has a QR code and a direct APK download link. Send either to a friend.

## Installing (friend's phone)

1. Open the link on the phone (not a desktop — the QR code is for scanning
   *from* a phone you're not already on).
2. Tap the download button; Android will warn about installing from an
   unknown source — allow it for this file only.
3. Open the app. It generates its own device ID on first launch, so each
   friend automatically gets independent read state and topic prefs
   (DESIGN §5, `X-Device-Id`) — no account needed.

## Updating an install

Re-run the same `eas build` command and re-share the new build's link.
There's no auto-update; friends re-download when you tell them there's a new
build.

## Rate limiting (Phase 5 review)

API Gateway HTTP APIs default to 5,000 requests/sec steady-state / 10,000
burst account-wide — far above anything a handful of friends' phones will
ever produce. `infra/api.ts` sets an explicit, much lower default
(`defaultRouteSettings`) as a sanity ceiling in case a client bug causes a
retry storm; per-device abuse prevention is explicitly out of scope at this
trust level (DESIGN §5).
