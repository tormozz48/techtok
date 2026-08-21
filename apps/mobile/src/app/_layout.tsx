import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, ThemeProvider, useNavigationContainerRef } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { CrashFallback } from '@/components/CrashFallback';
import { LoadingScreen } from '@/components/LoadingScreen';
import {
  techtokDarkTheme,
  techtokLightTheme,
  techtokNavigationDarkTheme,
  techtokNavigationLightTheme,
} from '@/constants/paperTheme';
import { ONE_DAY_MS } from '@/constants/time';
import { useStrings } from '@/i18n/useStrings';
import { useAuthStore } from '@/state/authStore';
import { startEventsQueueFlushing } from '@/state/eventsQueue';
import { useLanguageStore } from '@/state/languageStore';
import { startNetworkMonitoring } from '@/state/network';
import { hasSeenOnboarding } from '@/state/onboardingStore';
import { queryClient } from '@/state/queryClient';
import { startReadQueueFlushing } from '@/state/readQueue';
import { navigationIntegration, Sentry } from '@/state/sentry';
import { ready } from '@/state/storage';
import { useThemeStore } from '@/state/themeStore';
import { useTopicsStore } from '@/state/topicsStore';

// A direct AsyncStorage adapter — the persister's own async-get/set shape
// doesn't fit state/storage.ts's sync-read cache, so this is a deliberate,
// narrow exception to that module's usual indirection.
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'techtok.queryCache',
});

function RootLayout() {
  const systemScheme = useColorScheme();
  const themeMode = useThemeStore((state) => state.mode);
  const colorScheme = themeMode === 'system' ? systemScheme : themeMode;
  const strings = useStrings();
  const authStatus = useAuthStore((state) => state.status);
  const [isHydrated, setIsHydrated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  useEffect(() => {
    ready().then(async () => {
      startNetworkMonitoring();
      useTopicsStore.getState().load();
      useThemeStore.getState().load();
      // Storage-only, network-free (unlike languageStore.load() below, which
      // needs auth): the feed's query key is keyed by language, so the first
      // render has to already know the persisted one. Without this the feed
      // mounted under 'en', then swapped to the real language a second later
      // — replacing every card in the pager, which cancels any tap already
      // in flight on the first card (confirmed in production access logs:
      // four GET /v1/feed calls and two read-ahead prefetch bursts with
      // different post ids inside 1.6s of every launch).
      useLanguageStore.getState().hydrate();
      setShowOnboarding(!hasSeenOnboarding());
      // Held inside the same hydration gate as everything else (D68): a
      // silent-restore attempt (Google Sign-In's own persisted session, not
      // anything this app caches) resolves before the first Stack.Protected
      // guard evaluates, so a signed-in user never sees a flash of /auth.
      await useAuthStore.getState().restore();
      // Started only after sign-in resolves, for the same reason
      // languageStore.load() is deferred below. Both flushers POST to
      // authenticated routes the instant they start, and starting them first
      // fired those POSTs with no Authorization header at all — the 401 then
      // kicked off a *second* silent sign-in concurrent with restore()'s own,
      // and whichever lost wrote `signedOut` over the restored session. That
      // is what showed a signed-in user /auth for a moment at launch, until
      // the next 5s/15s flush tick 401'd again and recovered it.
      startReadQueueFlushing();
      startEventsQueueFlushing();
      setIsHydrated(true);
    });
  }, []);

  // languageStore's own load() reconciles the persisted language with the
  // server's Users.language — deferred until sign-in is confirmed (unlike
  // topicsStore/themeStore above) since it used to fire inside the block
  // above, before `restore()` resolved, sending an unauthenticated GET /v1/me
  // that depended on winning a race against a silent re-sign-in retry to
  // ever recover. Re-runs on every future sign-in too (a first-ever sign-in
  // via /auth, or a re-sign-in after a sign-out), not just the first cold
  // start.
  useEffect(() => {
    if (authStatus === 'signedIn') {
      useLanguageStore.getState().load();
    }
  }, [authStatus]);

  // Foregrounding the app counts as a TanStack Query "focus" event, so a feed
  // left stale (see FEED_STALE_TIME_MS) refetches on return instead of only
  // on relaunch or a settings change.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);

  // Same branded LoadingScreen as the feed's own first-fetch gate (D25) —
  // native splash -> this -> the feed's loading gate should read as one
  // continuous blue screen, not a flash of the app's usual black theme
  // in between. Hydration (a few AsyncStorage reads) is normally near-instant.
  if (!isHydrated) {
    return <LoadingScreen />;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ONE_DAY_MS,
        // Feed, bookmarks, and compact-article content persist offline;
        // history/me stay cheap-refetch-only. Content is the one worth
        // restoring without a network hit at all — since D82 dropped the
        // wifi-gated prefetch, it holds articles the user actually opened,
        // so a re-read offline still works.
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.queryKey[0] === 'feed' ||
            query.queryKey[0] === 'bookmarks' ||
            query.queryKey[0] === 'content',
        },
      }}
    >
      <PaperProvider theme={colorScheme === 'dark' ? techtokDarkTheme : techtokLightTheme}>
        <ThemeProvider
          value={colorScheme === 'dark' ? techtokNavigationDarkTheme : techtokNavigationLightTheme}
        >
          <StatusBar style="auto" />
          <Stack
            screenOptions={{ headerShown: false }}
            // Only ever names a screen from the currently-active
            // Stack.Protected group below — 'onboarding'/'index' exist only
            // when signed in, so naming one while signed out (e.g. a fresh
            // device's very first render, before any sign-in) throws
            // "Couldn't find a screen named '...' to use as
            // 'initialRouteName'" and crashes the app (confirmed live on a
            // real device that hit this exact signed-out-at-first-paint
            // case; an emulator with a persisted sign-in session skipped
            // this window and never hit it).
            initialRouteName={
              authStatus === 'signedIn' ? (showOnboarding ? 'onboarding' : 'index') : undefined
            }
          >
            {/* D68: sign-in gates every other screen. Stack.Protected redirects
                automatically when its guard flips — no manual router.replace
                calls needed on sign-in/sign-out. */}
            <Stack.Protected guard={authStatus === 'signedIn'}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen
                name="settings"
                options={{
                  presentation: 'modal',
                  headerShown: true,
                  title: strings.settings.title,
                }}
              />
              <Stack.Screen
                name="history"
                options={{ headerShown: true, title: strings.history.title }}
              />
              <Stack.Screen
                name="saved"
                options={{ headerShown: true, title: strings.saved.title }}
              />
              <Stack.Screen
                name="stats"
                options={{ headerShown: true, title: strings.stats.title }}
              />
              <Stack.Screen
                name="account"
                options={{ headerShown: true, title: strings.account.title }}
              />
              <Stack.Screen
                name="paywall"
                options={{
                  presentation: 'modal',
                  headerShown: true,
                  title: strings.paywall.title,
                }}
              />
              <Stack.Screen name="post/[id]" options={{ headerShown: true, title: '' }} />
            </Stack.Protected>
            <Stack.Protected guard={authStatus !== 'signedIn'}>
              <Stack.Screen name="auth" />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </PaperProvider>
    </PersistQueryClientProvider>
  );
}

function AppRoot() {
  return (
    <Sentry.ErrorBoundary fallback={CrashFallback}>
      <RootLayout />
    </Sentry.ErrorBoundary>
  );
}

export default Sentry.wrap(AppRoot);
