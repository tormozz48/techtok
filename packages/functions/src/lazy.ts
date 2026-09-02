export function lazy<T>(create: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= create());
}
