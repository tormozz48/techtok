import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DOTENV_PATH = resolve(ROOT, 'apps/mobile/.env');

const DOCS_DISTRIBUTION_PLACEHOLDER_API_URL =
  'https://your-api-id.execute-api.eu-central-1.amazonaws.com';

const EU_CENTRAL_1_API_GATEWAY_URL_RE =
  /^https:\/\/[a-z0-9]+\.execute-api\.eu-central-1\.amazonaws\.com$/;

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
  if (url === DOCS_DISTRIBUTION_PLACEHOLDER_API_URL) {
    return {
      ok: false,
      reason:
        "EXPO_PUBLIC_API_URL is still the placeholder from docs/DISTRIBUTION.md. Replace it with the real API URL before building — see docs/DISTRIBUTION.md's aws apigatewayv2 get-apis lookup.",
    };
  }
  if (!EU_CENTRAL_1_API_GATEWAY_URL_RE.test(url)) {
    return {
      ok: false,
      reason: `EXPO_PUBLIC_API_URL ("${url}") doesn't look like an eu-central-1 API Gateway HTTP API URL (expected https://<api-id>.execute-api.eu-central-1.amazonaws.com, no path).`,
    };
  }
  return { ok: true };
}

export function main(): void {
  const url = resolveApiUrlFromEnvThenDotenv();
  const result = checkApiUrl(url);

  if (!result.ok) {
    console.error(`✖ ${result.reason}`);
    process.exit(1);
  }

  console.log(`EXPO_PUBLIC_API_URL: ${url}`);
  console.log(
    'This only confirms the URL is well-formed eu-central-1 API Gateway shape, not that it is the PRODUCTION stage specifically — dev and production API ids look identical. Confirm by eye before continuing.',
  );
}

function resolveApiUrlFromEnvThenDotenv(): string | undefined {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (!existsSync(DOTENV_PATH)) return undefined;
  const line = readFileSync(DOTENV_PATH, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith('EXPO_PUBLIC_API_URL='));
  return line?.slice(line.indexOf('=') + 1).trim();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
