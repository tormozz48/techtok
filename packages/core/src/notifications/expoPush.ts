import { chunk } from '../util/chunk';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

export interface ExpoPushMessage {
  readonly to: string;
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, unknown>;
}

export interface ExpoPushSender {
  send(messages: ExpoPushMessage[]): Promise<void>;
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
