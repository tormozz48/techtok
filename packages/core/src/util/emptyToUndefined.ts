export function emptyToUndefined<T>(items: T[]): T[] | undefined {
  return items.length > 0 ? items : undefined;
}
