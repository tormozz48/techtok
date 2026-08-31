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
import { useHapticsStore } from '@/state/hapticsStore';
import { useLanguageStore } from '@/state/languageStore';
import { startNetworkMonitoring } from '@/state/network';
import { hasSeenOnboarding } from '@/state/onboardingStore';
import { queryClient } from '@/state/queryClient';
import { startReadQueueFlushing } from '@/state/readQueue';
import { navigationIntegration, Sentry } from '@/state/sentry';
import { ready } from '@/state/storage';
import { useThemeStore } from '@/state/themeStore';
import { useTopicsStore } from '@/state/topicsStore';
import { startOtaUpdates } from '@/state/updates';

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'techtok.queryCache',
});

export default Sentry.wrap(AppRoot);

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
    startOtaUpdates();
  }, []);

  useEffect(() => {
    ready().then(async () => {
      startNetworkMonitoring();
      useTopicsStore.getState().load();
      useThemeStore.getState().load();
      useHapticsStore.getState().load();
      useLanguageStore.getState().hydrate();
      setShowOnboarding(!hasSeenOnboarding());
      await useAuthStore.getState().restore();
      startReadQueueFlushing();
      startEventsQueueFlushing();
      setIsHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (authStatus === 'signedIn') {
      useLanguageStore.getState().load();
    }
  }, [authStatus]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);

  if (!isHydrated) {
    return <LoadingScreen />;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ONE_DAY_MS,
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
            initialRouteName={
              authStatus === 'signedIn' ? (showOnboarding ? 'onboarding' : 'index') : undefined
            }
          >
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
