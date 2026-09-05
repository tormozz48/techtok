import { queryClient } from './queryClient';
import { storage } from './storage';
import { DEVICE_SCOPED_KEYS } from './storageKeys';

export async function clearUserScopedState(): Promise<void> {
  queryClient.clear();
  await storage.clearExcept(DEVICE_SCOPED_KEYS);
}
