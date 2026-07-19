import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';
import { Colors } from '@/constants/theme';
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
      setShowOnboarding(!hasSeenOnboarding());
      setIsHydrated(true);
    });
  }, []);

  if (!isHydrated) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#fff" />
      </View>
    );
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
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
        </Stack>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
