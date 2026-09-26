import { createTesterGroupClient, type TesterGroupClient } from '@techtok/core';
import { requireEnv } from './env';
import { lazy } from './lazy';

export const getTesterGroupClient = lazy<TesterGroupClient>(() =>
  createTesterGroupClient(
    requireEnv('PLAY_SERVICE_ACCOUNT_KEY'),
    requireEnv('TESTERS_GROUP_EMAIL'),
  ),
);

export function isTesterGroupConfigured(): boolean {
  return Boolean(process.env.PLAY_SERVICE_ACCOUNT_KEY && process.env.TESTERS_GROUP_EMAIL);
}
