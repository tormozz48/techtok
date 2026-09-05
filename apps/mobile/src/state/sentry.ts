import * as Sentry from '@sentry/react-native';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

const TRACES_SAMPLE_RATE = 0.1;

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export { Sentry };

function stripQuery(url: string): string {
  const separator = url.indexOf('?');
  return separator === -1 ? url : url.slice(0, separator);
}

Sentry.init({
  dsn: 'https://bfd5dd410764a23a482d4f7eacf60507@o4511914103144448.ingest.de.sentry.io/4511914113106000',
  environment: __DEV__ ? 'development' : 'production',

  attachStacktrace: false,
  attachScreenshot: false,
  attachViewHierarchy: false,
  enableCaptureFailedRequests: true,

  tracesSampleRate: TRACES_SAMPLE_RATE,
  tracePropagationTargets: apiUrl ? [apiUrl] : [],
  integrations: [navigationIntegration],

  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  beforeBreadcrumb: (breadcrumb) => {
    const url = breadcrumb.data?.url;
    if (typeof url === 'string') {
      breadcrumb.data = { ...breadcrumb.data, url: stripQuery(url) };
    }
    return breadcrumb;
  },

  beforeSend: (event) => {
    if (event.user) {
      event.user = { ...event.user, ip_address: undefined };
    }
    if (event.request?.url) {
      event.request = { ...event.request, url: stripQuery(event.request.url) };
    }
    return event;
  },
});
