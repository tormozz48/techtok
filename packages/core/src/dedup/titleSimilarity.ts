export const DEFAULT_SIMILARITY_THRESHOLD = 0.6;

export function isLikelyDuplicateTitle(
  a: string,
  b: string,
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
): boolean {
  return tokenSetJaccard(a, b) >= threshold;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

function tokenSetJaccard(a: string, b: string): number {
  const setA = new Set(normalizeTitle(a).split(' ').filter(Boolean));
  const setB = new Set(normalizeTitle(b).split(' ').filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}
