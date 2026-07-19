import * as Crypto from 'expo-crypto';
import { storage } from './storage';

const DEVICE_ID_KEY = 'techtok.deviceId';

export function getOrCreateDeviceId(): string {
  const existing = storage.getString(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = Crypto.randomUUID();
  storage.set(DEVICE_ID_KEY, id);
  return id;
}
