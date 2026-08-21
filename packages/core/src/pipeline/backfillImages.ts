import { extractFromHtml } from '@extractus/article-extractor';
import { isGenericImage } from './genericImageDenylist';

export interface ImageBackfillCandidate {
  readonly postId: string;
  readonly url: string;
  readonly s3RawKey: string;
}

export interface ImageBackfillPage {
  readonly candidates: readonly ImageBackfillCandidate[];
  readonly nextBefore: string | undefined;
}

export interface BackfillImagesDeps {
  readonly nextCandidates: (before: string | undefined) => Promise<ImageBackfillPage>;
  readonly getRawHtml: (s3RawKey: string) => Promise<string>;
  readonly mirrorImage: (postId: string, imageUrl: string) => Promise<string | undefined>;
  readonly updateMirroredImage: (postId: string, mirroredImageUrl: string) => Promise<void>;
  readonly onError?: (postId: string, error: unknown) => void;
}

export interface BackfillImagesResult {
  readonly scanned: number;
  readonly mirrored: number;
  readonly skipped: number;
}

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
