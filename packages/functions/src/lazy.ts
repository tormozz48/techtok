/**
 * Memoizes a factory so each Lambda container builds a client/repo once, on
 * first use — replacing the hand-rolled `let x; function getX() {...}`
 * boilerplate that every handler file used to repeat.
 */
export function lazy<T>(create: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= create());
}
