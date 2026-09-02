import { logEvent } from './eventsQueue';
import { storage } from './storage';

const ONBOARDING_KEY = 'techtok.hasSeenOnboarding';

export function hasSeenOnboarding(): boolean {
  return storage.getString(ONBOARDING_KEY) === 'true';
}

export function markOnboardingSeen(): void {
  storage.set(ONBOARDING_KEY, 'true');
  logEvent('onboarding_seen');
}
