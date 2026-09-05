const STRIPPED_HEADERS = new Set([
  'return-path',
  'sender',
  'message-id',
  'dkim-signature',
  'from',
  'reply-to',
]);

const HEADER_BODY_SEPARATOR = /\r?\n\r?\n/;
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;
const BASE64_LINE_LENGTH = 76;

export interface RewriteForForwardingInput {
  raw: string;
  fromAddress: string;
  viaLabel: string;
}

export interface OversizeNoticeInput {
  fromAddress: string;
  forwardTo: string;
  originalFrom: string;
  subject: string;
  sizeBytes: number;
  s3Uri: string;
}

export function rewriteForForwarding({
  raw,
  fromAddress,
  viaLabel,
}: RewriteForForwardingInput): string {
  const separator = raw.match(HEADER_BODY_SEPARATOR);
  const splitAt = separator?.index ?? raw.length;
  const body = separator ? raw.slice(splitAt + separator[0].length) : '';
  const headers = unfoldHeaders(raw.slice(0, splitAt));

  const originalFrom = findHeaderValue(headers, 'from') ?? '';
  const originalReplyTo = findHeaderValue(headers, 'reply-to');
  const kept = headers.filter((line) => !STRIPPED_HEADERS.has(headerName(line)));

  const rewritten = [
    `From: ${buildFromHeader(originalFrom, fromAddress, viaLabel)}`,
    `Reply-To: ${originalReplyTo ?? originalFrom}`,
    ...kept,
  ];

  return `${rewritten.join('\r\n')}\r\n\r\n${body}`;
}

export function buildOversizeNotice({
  fromAddress,
  forwardTo,
  originalFrom,
  subject,
  sizeBytes,
  s3Uri,
}: OversizeNoticeInput): string {
  const megabytes = (sizeBytes / (1024 * 1024)).toFixed(1);
  const body = [
    `A ${megabytes} MB message from ${originalFrom} exceeded the forwarding size limit and was not relayed.`,
    `The original is retained for 30 days at ${s3Uri}.`,
    '',
  ].join('\r\n');

  return [
    `From: "TechTok mail forwarder" <${fromAddress}>`,
    `To: ${forwardTo}`,
    `Subject: ${encodeHeaderText(`[oversize] ${subject}`)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(Buffer.from(body, 'utf8').toString('base64')),
  ].join('\r\n');
}

export function pickFromAddress(
  recipients: string[] | undefined,
  mailDomain: string,
  fallbackFrom: string,
): string {
  const matched = (recipients ?? []).find((address) =>
    address.toLowerCase().endsWith(`@${mailDomain.toLowerCase()}`),
  );
  return matched ?? fallbackFrom;
}

function unfoldHeaders(headerBlock: string): string[] {
  const lines = headerBlock.split(/\r?\n/);
  const unfolded: string[] = [];

  for (const line of lines) {
    const previous = unfolded.length - 1;
    if (/^[ \t]/.test(line) && previous >= 0) {
      unfolded[previous] = `${unfolded[previous]}\r\n${line}`;
      continue;
    }
    if (line.length > 0) {
      unfolded.push(line);
    }
  }

  return unfolded;
}

function headerName(line: string): string {
  const colon = line.indexOf(':');
  return colon === -1 ? '' : line.slice(0, colon).trim().toLowerCase();
}

function findHeaderValue(headers: string[], name: string): string | undefined {
  const found = headers.find((line) => headerName(line) === name);
  return found === undefined ? undefined : found.slice(found.indexOf(':') + 1).trim();
}

function buildFromHeader(originalFrom: string, fromAddress: string, viaLabel: string): string {
  const label = `${originalFrom} (${viaLabel})`.replace(/[\r\n]+/g, ' ').trim();
  return `${encodeDisplayName(label)} <${fromAddress}>`;
}

function encodeDisplayName(latin1Label: string): string {
  if (PRINTABLE_ASCII.test(latin1Label)) {
    return `"${latin1Label.replace(/["\\]/g, '')}"`;
  }
  return `=?UTF-8?B?${Buffer.from(latin1Label, 'latin1').toString('base64')}?=`;
}

function encodeHeaderText(text: string): string {
  if (PRINTABLE_ASCII.test(text)) {
    return text;
  }
  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function wrapBase64(encoded: string): string {
  const lines: string[] = [];
  for (let offset = 0; offset < encoded.length; offset += BASE64_LINE_LENGTH) {
    lines.push(encoded.slice(offset, offset + BASE64_LINE_LENGTH));
  }
  return lines.join('\r\n');
}
