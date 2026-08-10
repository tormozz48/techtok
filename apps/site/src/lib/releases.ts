import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../..');

/** Matches release-cleanup.yml's KEEP="3" retention (D46/D57) for mobile-v*
 * tags. Not derived from it — a GitHub Actions env var and this build-time
 * literal have no clean shared source — so if that retention ever changes,
 * update this too (D60). */
const RELEASE_HISTORY_COUNT = 3;

export interface ReleaseEntry {
  version: string;
  date: string;
  features: string[];
  fixes: string[];
  other: string[];
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

const SECTION_RE = /^###\s+(Features|Fixes)\s*$/;
const BULLET_RE = /^-\s+(.+)$/;
const ITALIC_RE = /^_(.+)_$/;

/**
 * Parses a mobile-v* annotated tag's message into structured bullets.
 * Handles two real shapes seen in this repo's actual tag history: D58's
 * intended "## What's changed" / "### Features" / "### Fixes" sectioning,
 * and the flat unsectioned bullet list every tag up through mobile-v0.15.1
 * actually carries — not a generator bug, but `git tag -a -F` stripping any
 * `#`-prefixed line (including those Markdown headers) as a comment before
 * storing the tag message, fixed going forward by `--cleanup=verbatim` in
 * mobile-build.yml (D58 amendment). Existing tags predate the fix and are
 * immutable, so this fallback stays load-bearing indefinitely for them —
 * unsectioned bullets land in `other` rather than being dropped. A message
 * with no bullets at all (a bare commit subject, or the italic
 * "no user-facing changes" note) becomes a single `other` entry instead of
 * an empty release, so something always renders.
 */
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

/**
 * Reads the RELEASE_HISTORY_COUNT most recent mobile-v* tags (D42/D58) and
 * their annotated changelog messages, entirely from local git metadata —
 * no GitHub API call, mirroring scripts/bumpMobileVersion.ts's existing
 * execFileSync('git', ...) pattern. Degrades to fewer (or zero) entries
 * rather than throwing on any error — a shallow checkout with no tags, a
 * repo with no releases yet, or an unexpected git failure all just mean an
 * emptier list, never a failed site build.
 */
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
