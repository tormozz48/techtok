import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const APP_JSON_PATH = resolve(ROOT, 'apps/mobile/app.json');
const PACKAGE_JSON_PATH = resolve(ROOT, 'apps/mobile/package.json');
const BUILD_GRADLE_PATH = resolve(ROOT, 'apps/mobile/android/app/build.gradle');

export type BumpType = 'major' | 'minor' | 'patch' | 'none';

const BREAKING_FOOTER_RE = /^BREAKING CHANGE:/m;
const HEADER_RE = /^(\w+)(?:\([^)]*\))?(!)?:/;
const BUMP_RANK: Record<BumpType, number> = { none: 0, patch: 1, minor: 2, major: 3 };

/** Conventional-commit bump classification (CLAUDE.md's existing commit
 * types): a `BREAKING CHANGE:` footer or a `!` after the type/scope is
 * major, `feat` is minor, `fix` is patch, anything else doesn't bump. */
export function classifyCommit(message: string): BumpType {
  if (BREAKING_FOOTER_RE.test(message)) return 'major';
  const header = message.split('\n')[0] ?? '';
  const match = HEADER_RE.exec(header);
  if (!match) return 'none';
  const [, type, breakingBang] = match;
  if (breakingBang) return 'major';
  if (type === 'feat') return 'minor';
  if (type === 'fix') return 'patch';
  return 'none';
}

/** The highest-ranked bump across every commit message in the range. */
export function highestBump(messages: string[]): BumpType {
  let highest: BumpType = 'none';
  for (const message of messages) {
    const bump = classifyCommit(message);
    if (BUMP_RANK[bump] > BUMP_RANK[highest]) highest = bump;
  }
  return highest;
}

export function applyBump(version: string, bump: BumpType): string {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
  switch (bump) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'none':
      return version;
  }
}

function readAppVersion(): string {
  const appJson = JSON.parse(readFileSync(APP_JSON_PATH, 'utf8'));
  return appJson.expo.version as string;
}

function writeAppVersion(version: string): void {
  const appJson = JSON.parse(readFileSync(APP_JSON_PATH, 'utf8'));
  appJson.expo.version = version;
  writeFileSync(APP_JSON_PATH, `${JSON.stringify(appJson, null, 2)}\n`);
}

function writePackageVersion(version: string): void {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  pkg.version = version;
  writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(pkg, null, 2)}\n`);
}

function readCurrentVersionCode(): number {
  const gradle = readFileSync(BUILD_GRADLE_PATH, 'utf8');
  const match = /versionCode\s+(\d+)/.exec(gradle);
  if (!match?.[1]) throw new Error(`Could not find versionCode in ${BUILD_GRADLE_PATH}`);
  return Number(match[1]);
}

function writeBuildGradle(version: string, versionCode: number): void {
  const gradle = readFileSync(BUILD_GRADLE_PATH, 'utf8')
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
  writeFileSync(BUILD_GRADLE_PATH, gradle);
}

function findLastMobileTag(): string | undefined {
  try {
    return execFileSync('git', ['describe', '--tags', '--match', 'mobile-v*', '--abbrev=0'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

function commitMessagesSince(tag: string | undefined): string[] {
  const range = tag ? `${tag}..HEAD` : 'HEAD';
  const raw = execFileSync('git', ['log', range, '--format=%B%x00'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return raw
    .split('\0')
    .map((message) => message.trim())
    .filter(Boolean);
}

function main(): void {
  const currentVersion = readAppVersion();
  const lastTag = findLastMobileTag();

  let nextVersion: string;
  if (!lastTag) {
    // First run, no mobile-v* tag yet: app.json's existing version becomes
    // the canonical baseline going forward — reconcile package.json and
    // build.gradle to it instead of computing a bump across the entire
    // pre-automation commit history.
    nextVersion = currentVersion;
    console.log(
      `No prior mobile-v* tag found — reconciling package.json/build.gradle to app.json's ${currentVersion}.`,
    );
  } else {
    const messages = commitMessagesSince(lastTag);
    const bump = highestBump(messages);
    if (bump === 'none') {
      console.log(`No feat/fix/breaking commits since ${lastTag} — nothing to bump.`);
      return;
    }
    nextVersion = applyBump(currentVersion, bump);
    console.log(`${bump} bump since ${lastTag}: ${currentVersion} -> ${nextVersion}`);
  }

  const nextVersionCode = readCurrentVersionCode() + 1;

  writeAppVersion(nextVersion);
  writePackageVersion(nextVersion);
  writeBuildGradle(nextVersion, nextVersionCode);

  console.log(
    `Wrote mobile-v${nextVersion} (versionCode ${nextVersionCode}) to app.json/package.json/build.gradle.`,
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
