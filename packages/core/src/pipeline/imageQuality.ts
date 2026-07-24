import { imageSize } from 'image-size';

/**
 * Minimum-dimension image quality gate (DESIGN §2 D28). A small RSS thumbnail
 * (~150-300px) stretched to fill a full-bleed card reads as blurry/pixelated;
 * 600px comfortably clears typical thumbnail sizes without rejecting normal
 * editorial images (usually 800px+).
 */
const MIN_DIMENSION_PX = 600;

export interface ImageQualityResult {
  readonly passes: boolean;
  readonly width?: number;
  readonly height?: number;
}

/**
 * Reads just the image header (no full decode) to get pixel dimensions.
 * Rejects anything under 600px in either dimension. An undecodable buffer is
 * treated as a fail-closed rejection, not a thrown error, so a malformed or
 * truncated image can never crash the transform pipeline.
 */
export function checkImageQuality(buffer: Buffer): ImageQualityResult {
  try {
    const { width, height } = imageSize(buffer);
    if (!width || !height) return { passes: false };
    return { passes: width >= MIN_DIMENSION_PX && height >= MIN_DIMENSION_PX, width, height };
  } catch {
    return { passes: false };
  }
}
