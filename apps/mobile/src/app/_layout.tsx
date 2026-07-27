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
import { useStrings } from '@/i18n/useStrings';
import { useLanguageStore } from '@/state/languageStore';
import { startNetworkMonitoring } from '@/state/network';
import { hasSeenOnboarding } from '@/state/onboardingStore';
import { startReadQueueFlushing } from '@/state/readQueue';
import { ready } from '@/state/storage';
import { useThemeStore } from '@/state/themeStore';
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
  const systemScheme = useColorScheme();
  const themeMode = useThemeStore((state) => state.mode);
  const colorScheme = themeMode === 'system' ? systemScheme : themeMode;
  const strings = useStrings();
  const [isHydrated, setIsHydrated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    ready().then(() => {
      startReadQueueFlushing();
      startNetworkMonitoring();
      useTopicsStore.getState().load();
      useLanguageStore.getState().load();
      useThemeStore.getState().load();
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
        // Feed, bookmarks, and compact-article content persist offline;
        // history/me stay cheap-refetch-only. Content is the one worth
        // restoring without a network hit at all — it's what
        // BookmarkButton/saved.tsx's wifi-gated prefetch is populating in
        // the first place (offline saved articles).
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
            initialRouteName={showOnboarding ? 'onboarding' : 'index'}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen
              name="settings"
              options={{ presentation: 'modal', headerShown: true, title: strings.settings.title }}
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
            <Stack.Screen name="post/[id]" options={{ headerShown: true, title: '' }} />
          </Stack>
        </ThemeProvider>
      </PaperProvider>
    </PersistQueryClientProvider>
  );
}
