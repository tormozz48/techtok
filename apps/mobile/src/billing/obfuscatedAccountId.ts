import * as Crypto from 'expo-crypto';

export async function obfuscatedAccountId(userId: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, userId, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}
