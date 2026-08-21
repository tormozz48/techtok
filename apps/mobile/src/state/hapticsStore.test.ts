import { useHapticsStore } from './hapticsStore';
import { storage } from './storage';

describe('hapticsStore', () => {
  beforeEach(() => {
    storage.clearAll();
    useHapticsStore.setState({ enabled: true });
  });

  it('defaults to enabled', () => {
    expect(useHapticsStore.getState().enabled).toBe(true);
  });

  it('persists an opt-out and survives a reload of the store', () => {
    useHapticsStore.getState().setEnabled(false);
    expect(useHapticsStore.getState().enabled).toBe(false);

    useHapticsStore.setState({ enabled: true });
    useHapticsStore.getState().load();
    expect(useHapticsStore.getState().enabled).toBe(false);
  });

  it('persists re-enabling too', () => {
    useHapticsStore.getState().setEnabled(false);
    useHapticsStore.getState().setEnabled(true);

    useHapticsStore.setState({ enabled: false });
    useHapticsStore.getState().load();
    expect(useHapticsStore.getState().enabled).toBe(true);
  });

  it('falls back to enabled for a corrupt stored value', () => {
    storage.set('techtok.hapticsEnabled', 'nonsense');
    useHapticsStore.getState().load();
    expect(useHapticsStore.getState().enabled).toBe(true);
  });
});
