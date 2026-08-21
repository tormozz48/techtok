import type { Preview } from '@storybook/react-native-web-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { buildMD3Colors } from '@/constants/materialTheme';

const queryClient = new QueryClient();

const techtokLightTheme: MD3Theme = { ...MD3LightTheme, colors: buildMD3Colors('light') };
const techtokDarkTheme: MD3Theme = { ...MD3DarkTheme, colors: buildMD3Colors('dark') };

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
  globalTypes: {
    theme: {
      description: 'Color scheme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === 'dark' ? techtokDarkTheme : techtokLightTheme;
      return (
        <GestureHandlerRootView style={styles.root}>
          <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
              <PaperProvider theme={theme}>
                <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                  <Story />
                </View>
              </PaperProvider>
            </QueryClientProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      );
    },
  ],
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
  },
});

export default preview;
