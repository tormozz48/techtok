const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface ExpoPushSender {
  send(messages: ExpoPushMessage[]): Promise<void>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Expo's push API needs no API key (DESIGN's push-token-only auth model, D1
 * friends-scale). Batches of 100 per Expo's documented limit; failures throw
 * so the caller's Lambda invocation is retried by its own infra semantics
 * rather than silently dropping a day's digest.
 */
export function createExpoPushSender(fetchImpl: typeof fetch = fetch): ExpoPushSender {
  return {
    async send(messages: ExpoPushMessage[]): Promise<void> {
      for (const batch of chunk(messages, CHUNK_SIZE)) {
        const response = await fetchImpl(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(batch),
        });
        if (!response.ok) {
          throw new Error(`Expo push API responded ${response.status}`);
        }
      }
    },
  };
}
