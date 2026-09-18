import { createHash } from 'node:crypto';

export function obfuscatedAccountId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex');
}
