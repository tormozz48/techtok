import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { ApiError, fetchMe, putLanguage } from '@/api/client';
import { useLanguageStore } from './languageStore';
import { storage } from './storage';

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client');
  return {
    ...actual,
    fetchMe: vi.fn(),
    putLanguage: vi.fn(),
  };
});

const fetchMeMock = fetchMe as Mock;
const putLanguageMock = putLanguage as Mock;

beforeEach(() => {
  storage.clearAll();
  useLanguageStore.setState({ language: 'en', isLoading: false });
  fetchMeMock.mockReset();
  putLanguageMock.mockReset();
});

describe('languageStore', () => {
  describe('adoptServerLanguage', () => {
    it('adopts a different language the server reports and persists it', () => {
      useLanguageStore.getState().adoptServerLanguage('ru');

      expect(useLanguageStore.getState().language).toBe('ru');
      expect(storage.getString('techtok.language')).toBe('ru');
    });

    it('no-ops when the language already matches', () => {
      useLanguageStore.setState({ language: 'ru' });
      storage.set('techtok.language', 'ru');

      useLanguageStore.getState().adoptServerLanguage('ru');

      expect(useLanguageStore.getState().language).toBe('ru');
    });

    it('no-ops while a local setLanguage write is still in flight, so it never reverts a just-made choice', async () => {
      putLanguageMock.mockImplementation(() => new Promise(() => {}));
      const setPromise = useLanguageStore.getState().setLanguage('ru');
      expect(useLanguageStore.getState().isLoading).toBe(true);

      useLanguageStore.getState().adoptServerLanguage('en');

      expect(useLanguageStore.getState().language).toBe('ru');
      void setPromise;
    });
  });

  describe('setLanguage', () => {
    it('rolls back on an ApiError (the write never landed)', async () => {
      putLanguageMock.mockRejectedValue(new ApiError(500, undefined, 'boom'));

      await expect(useLanguageStore.getState().setLanguage('ru')).rejects.toThrow('boom');

      expect(useLanguageStore.getState().language).toBe('en');
      expect(storage.getString('techtok.language')).not.toBe('ru');
    });

    it('rolls back on a network failure (the write never landed)', async () => {
      putLanguageMock.mockRejectedValue(new TypeError('Network request failed'));

      await expect(useLanguageStore.getState().setLanguage('ru')).rejects.toThrow(
        'Network request failed',
      );

      expect(useLanguageStore.getState().language).toBe('en');
    });

    it('does NOT roll back on a response-parse failure — the server already committed the write', async () => {
      const zodError = new Error('invalid response');
      zodError.name = 'ZodError';
      putLanguageMock.mockRejectedValue(zodError);

      await expect(useLanguageStore.getState().setLanguage('ru')).rejects.toThrow(
        'invalid response',
      );

      expect(useLanguageStore.getState().language).toBe('ru');
      expect(storage.getString('techtok.language')).toBe('ru');
    });

    it('adopts the server-confirmed language on success', async () => {
      putLanguageMock.mockResolvedValue({ language: 'ru' });

      await useLanguageStore.getState().setLanguage('ru');

      expect(useLanguageStore.getState().language).toBe('ru');
      expect(storage.getString('techtok.language')).toBe('ru');
    });
  });

  describe('hydrate', () => {
    it('picks up a language persisted after import time, when the store still holds the pre-hydration fallback', () => {
      storage.set('techtok.language', 'ru');

      useLanguageStore.getState().hydrate();

      expect(useLanguageStore.getState().language).toBe('ru');
    });

    it('falls back to en when nothing valid is persisted', () => {
      storage.set('techtok.language', 'klingon');

      useLanguageStore.getState().hydrate();

      expect(useLanguageStore.getState().language).toBe('en');
    });

    it('makes no network call, so it is safe before auth has restored', () => {
      storage.set('techtok.language', 'pl');

      useLanguageStore.getState().hydrate();

      expect(fetchMeMock).not.toHaveBeenCalled();
      expect(useLanguageStore.getState().language).toBe('pl');
    });
  });

  describe('load', () => {
    it('reconciles to the server language on success', async () => {
      fetchMeMock.mockResolvedValue({ language: 'ru' });

      await useLanguageStore.getState().load();

      expect(useLanguageStore.getState().language).toBe('ru');
      expect(useLanguageStore.getState().isLoading).toBe(false);
    });

    it('leaves the cached value in place and does not throw when fetchMe fails', async () => {
      fetchMeMock.mockRejectedValue(new Error('offline'));

      await expect(useLanguageStore.getState().load()).resolves.toBeUndefined();

      expect(useLanguageStore.getState().language).toBe('en');
      expect(useLanguageStore.getState().isLoading).toBe(false);
    });
  });
});
