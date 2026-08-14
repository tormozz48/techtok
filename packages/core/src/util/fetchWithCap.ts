import { TECHTOK_BOT_USER_AGENT } from '../pipeline/transformArticle';

export interface FetchedBytes {
  readonly body: Buffer;
  readonly contentType: string | undefined;
}

export interface FetchWithCapOptions {
  /** Aborts the fetch once the streamed response body exceeds this size. */
  readonly maxBytes: number;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetches `url` with a request timeout and a streamed byte cap — shared by
 * every Lambda that fetches third-party content (article pages, images,
 * robots.txt), so the cap/timeout/UA behavior only needs to be right once.
 */
export async function fetchBytesWithCap(
  url: string,
  options: FetchWithCapOptions,
): Promise<FetchedBytes> {
  const { maxBytes, timeoutMs = DEFAULT_TIMEOUT_MS, userAgent = TECHTOK_BOT_USER_AGENT } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': userAgent },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`fetch ${url} failed with status ${response.status}`);
    }
    const contentType = response.headers.get('content-type') ?? undefined;
    if (!response.body) return { body: Buffer.from(await response.arrayBuffer()), contentType };

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        controller.abort();
        throw new Error(`response for ${url} exceeded ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
    return { body: Buffer.concat(chunks), contentType };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTextWithCap(url: string, options: FetchWithCapOptions): Promise<string> {
  const { body } = await fetchBytesWithCap(url, options);
  return body.toString('utf8');
}
