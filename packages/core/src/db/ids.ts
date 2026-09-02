const DECIMAL_ID = /^[1-9][0-9]*$/;

const MAX_INT4 = 2147483647;

export function decodeId(raw: string): number | undefined {
  if (!DECIMAL_ID.test(raw)) return undefined;
  const id = Number(raw);
  return id <= MAX_INT4 ? id : undefined;
}

export function decodeIds(raw: string[]): number[] {
  return raw.flatMap((value) => {
    const id = decodeId(value);
    return id === undefined ? [] : [id];
  });
}

export function encodeId(id: number): string {
  return String(id);
}
