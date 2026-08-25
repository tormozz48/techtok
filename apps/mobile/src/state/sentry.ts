import * as Sentry from '@sentry/react-native';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

Sentry.init({
  dsn: 'https://bfd5dd410764a23a482d4f7eacf60507@o4511914103144448.ingest.de.sentry.io/4511914113106000',
  environment: __DEV__ ? 'development' : 'production',

  attachStacktrace: false,
  attachScreenshot: true,
  attachViewHierarchy: true,
  enableCaptureFailedRequests: true,

  tracesSampleRate: 1.0,
  tracePropagationTargets: apiUrl ? [apiUrl] : [],
  enableUserInteractionTracing: true,
  integrations: [navigationIntegration],

  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});

export { Sentry };
