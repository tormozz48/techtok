import { createPlayApiClient, type PlayApiClient } from '@techtok/core';
import { requireEnv } from './env';
import { lazy } from './lazy';

export const getPlayApiClient = lazy<PlayApiClient>(() =>
  createPlayApiClient(requireEnv('PLAY_SERVICE_ACCOUNT_KEY'), requireEnv('PLAY_PACKAGE_NAME')),
);

export function isPlayBillingConfigured(): boolean {
  return Boolean(process.env.PLAY_SERVICE_ACCOUNT_KEY && process.env.PLAY_PACKAGE_NAME);
}
