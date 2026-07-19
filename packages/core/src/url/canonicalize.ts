import { createHash } from 'node:crypto';

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  'igshid',
]);

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

/**
 * Normalizes a URL for dedup purposes: strips tracking params and the
 * fragment, lowercases scheme/host, drops default ports and trailing
 * slashes, and sorts the remaining query params.
 */
export function canonicalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = '';
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  ) {
    url.port = '';
  }

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  const keptParams = [...url.searchParams.entries()]
    .filter(([key]) => !isTrackingParam(key))
    .sort(([a], [b]) => a.localeCompare(b));
  url.search = '';
  for (const [key, value] of keptParams) {
    url.searchParams.append(key, value);
  }

  return url.toString();
}

export function hashPostId(canonicalUrl: string): string {
  return createHash('sha256').update(canonicalUrl).digest('hex');
}
