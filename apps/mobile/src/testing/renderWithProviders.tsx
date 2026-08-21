import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { useBookmarksOverlay } from '@/state/bookmarksOverlay';
import { useLanguageStore } from '@/state/languageStore';
import { useSpeechStore } from '@/state/speechStore';

/** Fresh QueryClient per test -- retry:false so a rejected mock fails fast
 * instead of hanging on backoff retries. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Renders with the same QueryClientProvider wiring the real app uses, so
 * components calling useQueryClient()/useQuery() don't need their own
 * per-test boilerplate. Pass a client to seed cache data beforehand or
 * inspect it after an interaction; otherwise a fresh one is created. */
export function renderWithQueryClient(
  ui: ReactElement,
  queryClient: QueryClient = createTestQueryClient(),
) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

/** Resets the module-singleton zustand stores components under test read
 * from, so state one test sets (bookmark overlay, active language, speech
 * playback) can't leak into the next. Call from beforeEach. */
export function resetSharedStores(): void {
  useLanguageStore.setState({ language: 'en', isLoading: false });
  useBookmarksOverlay.setState({ overlay: {} });
  useSpeechStore.setState({ speakingId: null, availableLanguages: null });
}
