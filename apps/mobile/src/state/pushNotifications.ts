import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { putPushToken } from '@/api/client';
import { storage } from './storage';

const PUSH_ENABLED_KEY = 'techtok.pushEnabled';

export function isPushEnabled(): boolean {
  return storage.getString(PUSH_ENABLED_KEY) === 'true';
}

/**
 * Requests notification permission, fetches an Expo push token, and registers
 * it with the server (DESIGN §6 `Users.pushToken`, phase 5 digest). Remote
 * push tokens require a real native build — this silently no-ops in plain
 * Expo Go (see the `expo-go-native-module-constraint` memory); it's expected
 * to work once distributed via the phase-5 EAS build (docs/DISTRIBUTION.md).
 */
export async function enablePushNotifications(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let status = existingStatus;
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await putPushToken(pushToken);
    storage.set(PUSH_ENABLED_KEY, 'true');
    return true;
  } catch (err) {
    console.warn('enablePushNotifications failed', err);
    return false;
  }
}
