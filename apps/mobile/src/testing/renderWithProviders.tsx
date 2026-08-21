import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { useBookmarksOverlay } from '@/state/bookmarksOverlay';
import { useLanguageStore } from '@/state/languageStore';
import { useSpeechStore } from '@/state/speechStore';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

export function renderWithQueryClient(
  ui: ReactElement,
  queryClient: QueryClient = createTestQueryClient(),
) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

export function resetSharedStores(): void {
  useLanguageStore.setState({ language: 'en', isLoading: false });
  useBookmarksOverlay.setState({ overlay: {} });
  useSpeechStore.setState({ speakingId: null, availableLanguages: null });
}
