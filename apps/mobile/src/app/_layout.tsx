import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { LoadingScreen } from '@/components/LoadingScreen';
import {
  techtokDarkTheme,
  techtokLightTheme,
  techtokNavigationDarkTheme,
  techtokNavigationLightTheme,
} from '@/constants/paperTheme';
import { useLanguageStore } from '@/state/languageStore';
import { startNetworkMonitoring } from '@/state/network';
import { hasSeenOnboarding } from '@/state/onboardingStore';
import { startReadQueueFlushing } from '@/state/readQueue';
import { ready } from '@/state/storage';
import { useTopicsStore } from '@/state/topicsStore';

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: ONE_DAY_MS } },
});

// A direct AsyncStorage adapter — the persister's own async-get/set shape
// doesn't fit state/storage.ts's sync-read cache, so this is a deliberate,
// narrow exception to that module's usual indirection.
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'techtok.queryCache',
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isHydrated, setIsHydrated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    ready().then(() => {
      startReadQueueFlushing();
      startNetworkMonitoring();
      useTopicsStore.getState().load();
      useLanguageStore.getState().load();
      setShowOnboarding(!hasSeenOnboarding());
      setIsHydrated(true);
    });
  }, []);

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
        // Only the feed is worth restoring offline — history/bookmarks/me
        // are cheap to refetch and shouldn't bloat the persisted cache.
        dehydrateOptions: { shouldDehydrateQuery: (query) => query.queryKey[0] === 'feed' },
      }}
    >
      <PaperProvider theme={colorScheme === 'dark' ? techtokDarkTheme : techtokLightTheme}>
        <ThemeProvider
          value={colorScheme === 'dark' ? techtokNavigationDarkTheme : techtokNavigationLightTheme}
        >
          <StatusBar style="light" />
          <Stack
            screenOptions={{ headerShown: false }}
            initialRouteName={showOnboarding ? 'onboarding' : 'index'}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen
              name="settings"
              options={{ presentation: 'modal', headerShown: true, title: 'Settings' }}
            />
            <Stack.Screen name="history" options={{ headerShown: true, title: 'History' }} />
            <Stack.Screen name="saved" options={{ headerShown: true, title: 'Saved' }} />
            <Stack.Screen name="post/[id]" options={{ headerShown: true, title: '' }} />
          </Stack>
        </ThemeProvider>
      </PaperProvider>
    </PersistQueryClientProvider>
  );
}
