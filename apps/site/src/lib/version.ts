import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_JSON_PATH = resolve(__dirname, '../../../mobile/app.json');

interface ExpoAppConfig {
  expo: { version: string };
}

const appConfig: ExpoAppConfig = JSON.parse(readFileSync(APP_JSON_PATH, 'utf-8'));

/** Canonical source: apps/mobile/app.json's `expo.version` (D35), read at
 * build time so the site's version badge never drifts from the shipped APK. */
export const APP_VERSION: string = appConfig.expo.version;
