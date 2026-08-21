import { describe, expect, it } from 'vitest';
import { checkImageQuality } from './imageQuality';

function fakePng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  buf.write('\x89PNG\r\n\x1a\n', 0, 'binary');
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe('checkImageQuality', () => {
  it('rejects a real image below the 600px minimum in either dimension', () => {
    const result = checkImageQuality(fakePng(300, 200));

    expect(result).toEqual({ passes: false, width: 300, height: 200 });
  });

  it('passes a real image at or above the 600px minimum in both dimensions', () => {
    const result = checkImageQuality(fakePng(1200, 800));

    expect(result).toEqual({ passes: true, width: 1200, height: 800 });
  });

  it('rejects when only one dimension clears the minimum', () => {
    const result = checkImageQuality(fakePng(1200, 400));

    expect(result.passes).toBe(false);
  });

  it('fails closed (no throw) on a garbage, undecodable buffer', () => {
    const garbage = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    expect(() => checkImageQuality(garbage)).not.toThrow();
    expect(checkImageQuality(garbage)).toEqual({ passes: false });
  });
});
