import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DOTENV_PATH = resolve(ROOT, 'apps/mobile/.env');

// The exact placeholder docs/DISTRIBUTION.md ships — a store build baked
// with this literal value would compile fine and fail silently on-device.
const DOCS_PLACEHOLDER = 'https://your-api-id.execute-api.eu-central-1.amazonaws.com';

// API Gateway HTTP API hostnames: <api-id>.execute-api.<region>.amazonaws.com,
// no path. This only catches shape (wrong region, typo, stray path/slash) —
// dev and production are both opaque random api-ids, so no static check can
// tell the two apart. See docs/DESIGN.md D10 for the region choice.
const API_GATEWAY_SHAPE_RE = /^https:\/\/[a-z0-9]+\.execute-api\.eu-central-1\.amazonaws\.com$/;

export interface ApiUrlCheckResult {
  ok: boolean;
  reason?: string;
}

export function checkApiUrl(url: string | undefined): ApiUrlCheckResult {
  if (!url?.trim()) {
    return {
      ok: false,
      reason:
        'EXPO_PUBLIC_API_URL is not set. Set it in apps/mobile/.env or export it before building.',
    };
  }
  if (url === DOCS_PLACEHOLDER) {
    return {
      ok: false,
      reason:
        "EXPO_PUBLIC_API_URL is still the placeholder from docs/DISTRIBUTION.md. Replace it with the real API URL before building — see docs/DISTRIBUTION.md's aws apigatewayv2 get-apis lookup.",
    };
  }
  if (!API_GATEWAY_SHAPE_RE.test(url)) {
    return {
      ok: false,
      reason: `EXPO_PUBLIC_API_URL ("${url}") doesn't look like an eu-central-1 API Gateway HTTP API URL (expected https://<api-id>.execute-api.eu-central-1.amazonaws.com, no path).`,
    };
  }
  return { ok: true };
}

/** Reads EXPO_PUBLIC_API_URL from the process env first (covers CI, where
 * it's a workflow_dispatch input already exported as an env var), falling
 * back to a plain-text parse of apps/mobile/.env (covers a local
 * `pnpm build:android`, per docs/DISTRIBUTION.md). */
function resolveApiUrl(): string | undefined {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (!existsSync(DOTENV_PATH)) return undefined;
  const line = readFileSync(DOTENV_PATH, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith('EXPO_PUBLIC_API_URL='));
  return line?.slice(line.indexOf('=') + 1).trim();
}

export function main(): void {
  const url = resolveApiUrl();
  const result = checkApiUrl(url);

  if (!result.ok) {
    console.error(`✖ ${result.reason}`);
    process.exit(1);
  }

  // Shape alone can't prove this is production rather than dev — both are
  // opaque random api-ids in the same region — so surface it for a human
  // to eyeball rather than claim a certainty this check doesn't have.
  console.log(`EXPO_PUBLIC_API_URL: ${url}`);
  console.log(
    '⚠ Confirm this is the PRODUCTION API before continuing — this check only catches an unset, placeholder, or malformed value, not the wrong stage.',
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
