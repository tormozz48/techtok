const GENERIC_IMAGE_PATTERNS: readonly RegExp[] = [/arxiv-logo/i];

export function isGenericImage(url: string): boolean {
  return GENERIC_IMAGE_PATTERNS.some((pattern) => pattern.test(url));
}
