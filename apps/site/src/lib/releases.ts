import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../..');

const RELEASE_HISTORY_COUNT = 3;

export interface ReleaseEntry {
  version: string;
  date: string;
  features: string[];
  fixes: string[];
  other: string[];
}

const SECTION_RE = /^###\s+(Features|Fixes)\s*$/;
const BULLET_RE = /^-\s+(.+)$/;
const ITALIC_RE = /^_(.+)_$/;

export function parseChangelog(
  message: string,
): Pick<ReleaseEntry, 'features' | 'fixes' | 'other'> {
  const features: string[] = [];
  const fixes: string[] = [];
  const other: string[] = [];
  let current: string[] | null = null;

  for (const rawLine of message.split('\n')) {
    const line = rawLine.trim();
    if (!line || line === "## What's changed") continue;

    const heading = SECTION_RE.exec(line);
    if (heading) {
      current = heading[1] === 'Features' ? features : fixes;
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    const text = bullet ? (bullet[1] ?? line) : line;
    const italic = ITALIC_RE.exec(text);
    (current ?? other).push(italic ? (italic[1] ?? text) : text);
  }

  return { features, fixes, other };
}

export function getRecentReleases(): ReleaseEntry[] {
  try {
    const tags = listVersionTags().slice(0, RELEASE_HISTORY_COUNT);

    return tags
      .map((tag): ReleaseEntry | null => {
        const date = tagField(tag, '%(creatordate:iso-strict)');
        if (!date) return null;
        const { features, fixes, other } = parseChangelog(tagField(tag, '%(contents)'));
        return { version: tag.replace(/^mobile-v/, ''), date, features, fixes, other };
      })
      .filter((entry): entry is ReleaseEntry => entry !== null);
  } catch {
    return [];
  }
}

function runGit(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

function listVersionTags(): string[] {
  try {
    const output = runGit(['tag', '--list', 'mobile-v*', '--sort=-v:refname']).trim();
    return output ? output.split('\n') : [];
  } catch {
    return [];
  }
}

function tagField(tag: string, format: string): string {
  try {
    return runGit(['tag', '-l', `--format=${format}`, tag]).trim();
  } catch {
    return '';
  }
}
