import AsyncStorage from '@react-native-async-storage/async-storage';

const cache = new Map<string, string>();
let hydrated: Promise<void> | null = null;

export const storage = {
  getString(key: string): string | undefined {
    return cache.get(key);
  },
  set(key: string, value: string): void {
    cache.set(key, value);
    void AsyncStorage.setItem(key, value);
  },
  remove(key: string): void {
    cache.delete(key);
    void AsyncStorage.removeItem(key);
  },
  clearAll(): void {
    cache.clear();
    void AsyncStorage.clear();
  },
};

export function ready(): Promise<void> {
  hydrated ??= hydrate();
  return hydrated;
}

async function hydrate(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const entries = await AsyncStorage.multiGet(keys);
  for (const [key, value] of entries) {
    if (value !== null) cache.set(key, value);
  }
}
