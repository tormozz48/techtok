import {
  DEFAULT_TIMEOUT_MS as FETCH_TIMEOUT_MS,
  fetchBytesWithCap,
  fetchTextWithCap,
} from '@techtok/core';
import { MAX_ARTICLE_BYTES } from './limits';

export function fetchBytes(url: string, maxBytes: number) {
  return fetchBytesWithCap(url, { maxBytes, timeoutMs: FETCH_TIMEOUT_MS });
}

export function fetchText(url: string, maxBytes = MAX_ARTICLE_BYTES) {
  return fetchTextWithCap(url, { maxBytes, timeoutMs: FETCH_TIMEOUT_MS });
}

const robotsCache = new Map<string, string | undefined>();

export async function fetchRobotsTxt(robotsUrl: string): Promise<string | undefined> {
  if (robotsCache.has(robotsUrl)) return robotsCache.get(robotsUrl);
  const text = await fetchText(robotsUrl).catch(() => undefined);
  robotsCache.set(robotsUrl, text);
  return text;
}
