import { imageSize } from 'image-size';

const MIN_DIMENSION_PX = 600;

export interface ImageQualityResult {
  readonly passes: boolean;
  readonly width?: number;
  readonly height?: number;
}

export function checkImageQuality(buffer: Buffer): ImageQualityResult {
  try {
    const { width, height } = imageSize(buffer);
    if (!width || !height) return { passes: false };
    return { passes: width >= MIN_DIMENSION_PX && height >= MIN_DIMENSION_PX, width, height };
  } catch {
    return { passes: false };
  }
}
