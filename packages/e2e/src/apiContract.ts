import { randomUUID } from 'node:crypto';
import {
  bookmarksResponseSchema,
  DEVICE_ID_HEADER,
  DEVICE_LANGUAGE_HEADER,
  feedResponseSchema,
  historyResponseSchema,
  meResponseSchema,
  topicsResponseSchema,
} from '@techtok/shared';
import { discoverDevResources, getApiEndpoint } from './awsDiscovery';

/**
 * Calls the real deployed `dev` API over HTTP — exactly the requests the
 * mobile client makes on a fresh device — and parses every response through
 * the same `packages/shared` zod schemas the app itself uses. A parse
 * failure here means an already-installed, sideloaded APK (no auto-update,
 * D18) would fail to render (DESIGN §2 D34). Never run against `production`.
 */
async function main(): Promise<void> {
  const resources = await discoverDevResources();
  const apiEndpoint = await getApiEndpoint(resources.apiId);
  const deviceId = randomUUID();
  const headers = { [DEVICE_ID_HEADER]: deviceId, [DEVICE_LANGUAGE_HEADER]: 'en' };

  console.log(
    `Exercising the API contract against ${apiEndpoint} as a fresh device (${deviceId})...`,
  );

  const checks: Array<[string, () => Promise<void>]> = [
    [
      'GET /v1/topics',
      async () => {
        const res = await fetch(`${apiEndpoint}/v1/topics?lang=en`);
        if (!res.ok) throw new Error(`GET /v1/topics returned ${res.status}`);
        topicsResponseSchema.parse(await res.json());
      },
    ],
    [
      'GET /v1/me',
      async () => {
        const res = await fetch(`${apiEndpoint}/v1/me`, { headers });
        if (!res.ok) throw new Error(`GET /v1/me returned ${res.status}`);
        meResponseSchema.parse(await res.json());
      },
    ],
    [
      'GET /v1/feed',
      async () => {
        const res = await fetch(`${apiEndpoint}/v1/feed`, { headers });
        if (!res.ok) throw new Error(`GET /v1/feed returned ${res.status}`);
        feedResponseSchema.parse(await res.json());
      },
    ],
    [
      'GET /v1/history',
      async () => {
        const res = await fetch(`${apiEndpoint}/v1/history`, { headers });
        if (!res.ok) throw new Error(`GET /v1/history returned ${res.status}`);
        historyResponseSchema.parse(await res.json());
      },
    ],
    [
      'GET /v1/bookmarks',
      async () => {
        const res = await fetch(`${apiEndpoint}/v1/bookmarks`, { headers });
        if (!res.ok) throw new Error(`GET /v1/bookmarks returned ${res.status}`);
        bookmarksResponseSchema.parse(await res.json());
      },
    ],
  ];

  const failures: string[] = [];
  for (const [name, check] of checks) {
    try {
      await check();
      console.log(`  ok   ${name}`);
    } catch (err) {
      console.error(`  FAIL ${name}: ${err instanceof Error ? err.message : String(err)}`);
      failures.push(name);
    }
  }

  if (failures.length > 0) {
    throw new Error(`API contract check failed for: ${failures.join(', ')}`);
  }
  console.log('API contract E2E passed: every response parsed cleanly against packages/shared.');
}

main().catch((err) => {
  console.error('API contract E2E failed:', err);
  process.exitCode = 1;
});
