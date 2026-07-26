import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const APP_JSON_PATH = resolve(ROOT, 'apps/mobile/app.json');
const PACKAGE_JSON_PATH = resolve(ROOT, 'apps/mobile/package.json');
const BUILD_GRADLE_PATH = resolve(ROOT, 'apps/mobile/android/app/build.gradle');
const APP_JSON_GIT_PATH = 'apps/mobile/app.json';
const BUILD_GRADLE_GIT_PATH = 'apps/mobile/android/app/build.gradle';

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

/** PR-branch bump (D43): compares the PR head against its base branch rather
 * than the last `mobile-v*` tag (D35/D40's now-retired approach). A manual
 * bump already present on the PR head always wins over automation. Writes
 * the three files only — committing/pushing is left to the caller
 * (`stefanzweifel/git-auto-commit-action` in CI), so this stays a pure,
 * testable, no-git-write operation beyond the version files themselves. */
export function main(baseRef: string): void {
  const baseVersion = appJsonVersionAtRef(baseRef);
  const currentVersion = currentAppJsonVersion();

  if (currentVersion !== baseVersion) {
    console.log(
      `app.json version (${currentVersion}) already differs from base (${baseVersion}) — manual bump present, skipping.`,
    );
    return;
  }

  const bump = highestBump(commitMessagesSince(baseRef));
  if (bump === 'none') {
    console.log('No feat/fix commits since base — no bump needed.');
    return;
  }

  const nextVersion = applyBump(baseVersion, bump);
  const nextVersionCode = versionCodeAtRef(baseRef) + 1;

  writeAppVersion(nextVersion);
  writePackageVersion(nextVersion);
  writeBuildGradle(nextVersion, nextVersionCode);

  console.log(
    `Bumped mobile version ${baseVersion} -> ${nextVersion} (versionCode ${nextVersionCode}, bump: ${bump})`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const baseRef = process.env.BASE_REF;
  if (!baseRef) throw new Error('BASE_REF env var required (e.g. origin/main)');
  main(baseRef);
}
