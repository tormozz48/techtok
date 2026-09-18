import { describe, expect, it } from 'vitest';
import { obfuscatedAccountId } from './obfuscatedAccountId';

const KNOWN_USER_ID = 'g:104512338877120044321';

const KNOWN_DIGEST = '2705bb44c36dd6aa05c9d9a490e7d08d0bd1486f63a6032d3a82b13cbba2d6e2';

describe('obfuscatedAccountId', () => {
  it('matches the digest the server derives for the same user id', async () => {
    await expect(obfuscatedAccountId(KNOWN_USER_ID)).resolves.toBe(KNOWN_DIGEST);
  });

  it('produces a 64-character hex string, Play’s exact ceiling', async () => {
    const id = await obfuscatedAccountId(KNOWN_USER_ID);

    expect(id).toHaveLength(64);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never echoes the Google subject it was derived from', async () => {
    await expect(obfuscatedAccountId(KNOWN_USER_ID)).resolves.not.toContain(
      '104512338877120044321',
    );
  });

  it('separates two users', async () => {
    const [a, b] = await Promise.all([obfuscatedAccountId('g:a'), obfuscatedAccountId('g:b')]);

    expect(a).not.toBe(b);
  });

  it('is stable across calls', async () => {
    const [first, second] = await Promise.all([
      obfuscatedAccountId(KNOWN_USER_ID),
      obfuscatedAccountId(KNOWN_USER_ID),
    ]);

    expect(first).toBe(second);
  });
});
