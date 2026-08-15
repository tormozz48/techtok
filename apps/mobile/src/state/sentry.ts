import * as Sentry from '@sentry/react-native';

// Scopes distributed-tracing headers to our own backend — the default
// (every request) would also attach them to third-party hosts (RSS-sourced
// images, Google Sign-In) for no benefit.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

Sentry.init({
  dsn: 'https://bfd5dd410764a23a482d4f7eacf60507@o4511914103144448.ingest.de.sentry.io/4511914113106000',
  environment: __DEV__ ? 'development' : 'production',

  // Errors: crash context beyond the default stack trace.
  attachScreenshot: true,
  attachViewHierarchy: true,
  enableCaptureFailedRequests: true,

  // Tracing/performance — free tier includes 5M spans/month.
  tracesSampleRate: 1.0,
  tracePropagationTargets: apiUrl ? [apiUrl] : [],
  enableUserInteractionTracing: true,
  integrations: [navigationIntegration],

  // Session Replay — free tier caps at 50 replays/month, so only record on
  // error rather than sampling whole sessions.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});

export { Sentry };
