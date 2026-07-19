import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { hasSeenOnboarding } from '@/state/onboardingStore';
import { startReadQueueFlushing } from '@/state/readQueue';
import { ready } from '@/state/storage';
import { useTopicsStore } from '@/state/topicsStore';

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isHydrated, setIsHydrated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    ready().then(() => {
      startReadQueueFlushing();
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
    <QueryClientProvider client={queryClient}>
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
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
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
