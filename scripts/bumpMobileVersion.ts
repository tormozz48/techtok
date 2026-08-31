import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const APP_JSON_PATH = resolve(ROOT, 'apps/mobile/app.json');
const PACKAGE_JSON_PATH = resolve(ROOT, 'apps/mobile/package.json');
const BUILD_GRADLE_PATH = resolve(ROOT, 'apps/mobile/android/app/build.gradle');
const STRINGS_XML_PATH = resolve(ROOT, 'apps/mobile/android/app/src/main/res/values/strings.xml');
const APP_JSON_GIT_PATH = 'apps/mobile/app.json';
const BUILD_GRADLE_GIT_PATH = 'apps/mobile/android/app/build.gradle';

export type BumpType = 'major' | 'minor' | 'patch' | 'none';

const BREAKING_FOOTER_RE = /^BREAKING CHANGE:/m;
const HEADER_RE = /^(\w+)(?:\([^)]*\))?(!)?:/;
const BUMP_RANK: Record<BumpType, number> = { none: 0, patch: 1, minor: 2, major: 3 };

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

function appJsonVersionAtRef(ref: string): string {
  const content = execFileSync('git', ['show', `${ref}:${APP_JSON_GIT_PATH}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(content).expo.version as string;
}

function currentAppJsonVersion(): string {
  return JSON.parse(readFileSync(APP_JSON_PATH, 'utf8')).expo.version as string;
}

function runtimeVersionAtRef(ref: string): string {
  const content = execFileSync('git', ['show', `${ref}:${APP_JSON_GIT_PATH}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(content).expo.runtimeVersion as string;
}

function currentRuntimeVersion(): string {
  return JSON.parse(readFileSync(APP_JSON_PATH, 'utf8')).expo.runtimeVersion as string;
}

function versionCodeAtRef(ref: string): number {
  const content = execFileSync('git', ['show', `${ref}:${BUILD_GRADLE_GIT_PATH}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const match = /versionCode\s+(\d+)/.exec(content);
  if (!match?.[1]) throw new Error(`Could not find versionCode at ${ref}`);
  return Number(match[1]);
}

function commitMessagesSince(baseRef: string): string[] {
  const log = execFileSync('git', ['log', `${baseRef}..HEAD`, '--format=%B%x00'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return log
    .split('\0')
    .map((message) => message.trim())
    .filter(Boolean);
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

function writeBuildGradle(version: string, versionCode: number): void {
  const gradle = readFileSync(BUILD_GRADLE_PATH, 'utf8')
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
  writeFileSync(BUILD_GRADLE_PATH, gradle);
}

function writeRuntimeVersion(version: string): void {
  const appJson = JSON.parse(readFileSync(APP_JSON_PATH, 'utf8'));
  appJson.expo.runtimeVersion = version;
  writeFileSync(APP_JSON_PATH, `${JSON.stringify(appJson, null, 2)}\n`);

  const strings = readFileSync(STRINGS_XML_PATH, 'utf8').replace(
    /(<string name="expo_runtime_version">)[^<]*(<\/string>)/,
    `$1${version}$2`,
  );
  writeFileSync(STRINGS_XML_PATH, strings);
}

function latestVersionTag(): string | null {
  const output = execFileSync('git', ['tag', '--list', 'mobile-v*', '--sort=-v:refname'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (!output) return null;
  return output.split('\n')[0] ?? null;
}

export function main(): void {
  const tag = latestVersionTag();
  if (!tag) {
    console.log('No mobile-v* tag found yet — skipping automated bump.');
    return;
  }

  const baseRuntimeVersion = runtimeVersionAtRef(tag);
  const currentRuntime = currentRuntimeVersion();
  if (currentRuntime === baseRuntimeVersion) {
    const nextRuntimeVersion = applyBump(baseRuntimeVersion, 'patch');
    writeRuntimeVersion(nextRuntimeVersion);
    console.log(
      `Bumped runtimeVersion ${baseRuntimeVersion} -> ${nextRuntimeVersion} (this script only runs on a native rebuild, so any already-installed build must stop matching it)`,
    );
  } else {
    console.log(
      `runtimeVersion (${currentRuntime}) already differs from ${tag} (${baseRuntimeVersion}) — manual bump present, skipping.`,
    );
  }

  const baseVersion = appJsonVersionAtRef(tag);
  const currentVersion = currentAppJsonVersion();

  if (currentVersion !== baseVersion) {
    console.log(
      `app.json version (${currentVersion}) already differs from ${tag} (${baseVersion}) — manual bump present, skipping.`,
    );
    return;
  }

  const bump = highestBump(commitMessagesSince(tag));
  if (bump === 'none') {
    console.log(`No feat/fix commits since ${tag} — no bump needed.`);
    return;
  }

  const nextVersion = applyBump(baseVersion, bump);
  const nextVersionCode = versionCodeAtRef(tag) + 1;

  writeAppVersion(nextVersion);
  writePackageVersion(nextVersion);
  writeBuildGradle(nextVersion, nextVersionCode);

  console.log(
    `Bumped mobile version ${baseVersion} -> ${nextVersion} (versionCode ${nextVersionCode}, bump: ${bump})`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
