import { createHash, randomUUID as nodeRandomUUID } from 'node:crypto';

export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' } as const;

export const CryptoEncoding = { HEX: 'hex' } as const;

export function randomUUID(): string {
  return nodeRandomUUID();
}

export async function digestStringAsync(_algorithm: string, data: string): Promise<string> {
  return createHash('sha256').update(data).digest('hex');
}
