import { extractFromHtml } from '@extractus/article-extractor';
import { isGenericImage } from './genericImageDenylist';

export interface ImageBackfillCandidate {
  readonly postId: string;
  readonly url: string;
  readonly s3RawKey: string;
}

export interface ImageBackfillPage {
  readonly candidates: readonly ImageBackfillCandidate[];
  /** Cursor for the next page, or undefined once the underlying post query
   * itself is exhausted. Deliberately independent of `candidates.length` —
   * a page can have zero eligible candidates (everyone in it already has an
   * image) while later pages still do, so pagination must continue based on
   * the raw query, not on how many of its rows matched. */
  readonly nextBefore: string | undefined;
}

export interface BackfillImagesDeps {
  /** Pages through posts missing a usable image but holding an archived raw
   * HTML page to mine (`Posts.imageUrl` and `mirroredImageUrl` both unset,
   * `s3RawKey` present) — paginated via the same `byTime` GSI cursor
   * `backfillLlm.ts` already uses, not a table scan. */
  readonly nextCandidates: (before: string | undefined) => Promise<ImageBackfillPage>;
  /** Reads the archived raw HTML for a post from S3. */
  readonly getRawHtml: (s3RawKey: string) => Promise<string>;
  /** Same contract as transformArticle's own `mirrorImage`: never throws,
   * undefined on any fetch/upload failure. */
  readonly mirrorImage: (postId: string, imageUrl: string) => Promise<string | undefined>;
  readonly updateMirroredImage: (postId: string, mirroredImageUrl: string) => Promise<void>;
  /** Reports a single candidate's failure (bad archive, S3 hiccup, ...) so
   * the caller can log it — never fatal, the run continues to the next
   * candidate either way. */
  readonly onError?: (postId: string, error: unknown) => void;
}

export interface BackfillImagesResult {
  readonly scanned: number;
  readonly mirrored: number;
  readonly skipped: number;
}

/**
 * One-shot backfill (IMPLEMENTATION_PLAN.md phase 7 task 3): for posts that
 * never got an image at ingest time but do have an archived raw HTML page
 * (`raw/<postId>.html` in S3, written by every transform run), mines the
 * page's og:image and mirrors it to the CDN — the same og:image rung
 * `transformArticle` uses (DESIGN §2 D24), just reading the archive instead
 * of a fresh fetch. No LLM calls, no live refetches. Safe to re-run:
 * candidates that already gained a `mirroredImageUrl` no longer match the
 * query, so nothing gets mirrored twice.
 */
export async function backfillImages(deps: BackfillImagesDeps): Promise<BackfillImagesResult> {
  let before: string | undefined;
  let scanned = 0;
  let mirrored = 0;
  let skipped = 0;

  for (;;) {
    const page = await deps.nextCandidates(before);

    for (const candidate of page.candidates) {
      scanned += 1;
      try {
        const html = await deps.getRawHtml(candidate.s3RawKey);
        const image = (await extractFromHtml(html, candidate.url))?.image;
        if (!image || isGenericImage(image)) {
          skipped += 1;
          continue;
        }

        const mirroredImageUrl = await deps.mirrorImage(candidate.postId, image);
        if (!mirroredImageUrl) {
          skipped += 1;
          continue;
        }

        await deps.updateMirroredImage(candidate.postId, mirroredImageUrl);
        mirrored += 1;
      } catch (err) {
        skipped += 1;
        deps.onError?.(candidate.postId, err);
      }
    }

    if (!page.nextBefore) break;
    before = page.nextBefore;
  }

  return { scanned, mirrored, skipped };
}
