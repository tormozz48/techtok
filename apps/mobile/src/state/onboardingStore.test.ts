import { hasSeenOnboarding, markOnboardingSeen } from './onboardingStore';
import { storage } from './storage';

describe('onboardingStore', () => {
  beforeEach(() => {
    storage.clearAll();
  });

  it('defaults to not seen', () => {
    expect(hasSeenOnboarding()).toBe(false);
  });

  it('is seen after marking, and stays seen', () => {
    markOnboardingSeen();
    expect(hasSeenOnboarding()).toBe(true);
    expect(hasSeenOnboarding()).toBe(true);
  });
});
