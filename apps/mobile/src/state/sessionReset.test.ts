import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postEvents, postReads } from '@/api/client';
import { flushEventsQueue, logEvent } from './eventsQueue';
import { useHapticsStore } from './hapticsStore';
import { hasSeenOnboarding, markOnboardingSeen } from './onboardingStore';
import { queryClient } from './queryClient';
import { enqueueRead, flushReadQueue } from './readQueue';
import { clearUserScopedState } from './sessionReset';
import { storage } from './storage';
import {
  HAPTICS_ENABLED_KEY,
  LANGUAGE_KEY,
  MUTED_SOURCES_KEY,
  QUERY_CACHE_KEY,
  THEME_MODE_KEY,
  TOPICS_KEY,
} from './storageKeys';
import { useThemeStore } from './themeStore';

vi.mock('@/api/client', () => ({
  postEvents: vi.fn(),
  postReads: vi.fn(),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  storage.clearAll();
  await AsyncStorage.clear();
  queryClient.clear();
});

describe('clearUserScopedState queues', () => {
  it('drops reads queued by the previous user instead of flushing them under the next token', async () => {
    enqueueRead('post-1');

    await clearUserScopedState();
    await flushReadQueue();

    expect(postReads).not.toHaveBeenCalled();
  });

  it('drops events queued by the previous user instead of flushing them under the next token', async () => {
    logEvent('feed_opened');

    await clearUserScopedState();
    await flushEventsQueue();

    expect(postEvents).not.toHaveBeenCalled();
  });
});

describe('clearUserScopedState query cache', () => {
  it('drops both the in-memory queries and the persisted cache blob', async () => {
    queryClient.setQueryData(['feed'], { items: ['post-1'] });
    await AsyncStorage.setItem(QUERY_CACHE_KEY, '{"clientState":{}}');

    await clearUserScopedState();

    expect(queryClient.getQueryData(['feed'])).toBeUndefined();
    expect(await AsyncStorage.getItem(QUERY_CACHE_KEY)).toBeNull();
  });
});

describe('clearUserScopedState account preferences', () => {
  it('drops the cached topics, muted sources and language of the previous user', async () => {
    storage.set(TOPICS_KEY, JSON.stringify(['space']));
    storage.set(MUTED_SOURCES_KEY, JSON.stringify(['arstechnica']));
    storage.set(LANGUAGE_KEY, 'ru');

    await clearUserScopedState();

    expect(storage.getString(TOPICS_KEY)).toBeUndefined();
    expect(storage.getString(MUTED_SOURCES_KEY)).toBeUndefined();
    expect(storage.getString(LANGUAGE_KEY)).toBeUndefined();
    expect(await AsyncStorage.getItem(TOPICS_KEY)).toBeNull();
  });

  it('forgets that onboarding was completed, so the next user picks topics again', async () => {
    markOnboardingSeen();

    await clearUserScopedState();

    expect(hasSeenOnboarding()).toBe(false);
  });

  it('drops keys it has never heard of, so a new per-user key is cleared by default', async () => {
    await AsyncStorage.setItem('techtok.somethingAddedLater', 'private');

    await clearUserScopedState();

    expect(await AsyncStorage.getItem('techtok.somethingAddedLater')).toBeNull();
  });
});

describe('clearUserScopedState device preferences', () => {
  it('keeps the theme mode, which belongs to the device rather than the account', async () => {
    useThemeStore.getState().setMode('dark');

    await clearUserScopedState();
    useThemeStore.getState().load();

    expect(await AsyncStorage.getItem(THEME_MODE_KEY)).toBe('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('keeps the haptics opt-out, which belongs to the device rather than the account', async () => {
    useHapticsStore.getState().setEnabled(false);

    await clearUserScopedState();
    useHapticsStore.getState().load();

    expect(await AsyncStorage.getItem(HAPTICS_ENABLED_KEY)).toBe('false');
    expect(useHapticsStore.getState().enabled).toBe(false);
  });
});
