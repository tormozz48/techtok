import { describe, expect, it } from 'vitest';
import { buildOversizeNotice, pickFromAddress, rewriteForForwarding } from './rewrite';

const FROM_ADDRESS = 'privacy@techtokapp.eu';
const VIA_LABEL = 'via TechTok';

function rewrite(raw: string): string {
  return rewriteForForwarding({ raw, fromAddress: FROM_ADDRESS, viaLabel: VIA_LABEL });
}

function asLatin1(utf8Text: string): string {
  return Buffer.from(utf8Text, 'utf8').toString('latin1');
}

describe('rewriteForForwarding', () => {
  it('replaces the From header with the verified sending address', () => {
    const result = rewrite(
      ['From: Jane Doe <jane@example.com>', 'Subject: Hello', '', 'Body text'].join('\r\n'),
    );

    expect(result).toContain(
      'From: "Jane Doe <jane@example.com> (via TechTok)" <privacy@techtokapp.eu>',
    );
    expect(result).not.toMatch(/^From: Jane Doe <jane@example\.com>$/m);
  });

  it('preserves the original sender in Reply-To', () => {
    const result = rewrite(['From: jane@example.com', 'Subject: Hello', '', 'Body'].join('\r\n'));

    expect(result).toContain('Reply-To: jane@example.com');
  });

  it('keeps an existing Reply-To in preference to the From address', () => {
    const result = rewrite(
      [
        'From: jane@example.com',
        'Reply-To: support@example.com',
        'Subject: Hello',
        '',
        'Body',
      ].join('\r\n'),
    );

    expect(result).toContain('Reply-To: support@example.com');
    expect(result).not.toContain('Reply-To: jane@example.com');
  });

  it('strips headers that no longer validate after the rewrite', () => {
    const result = rewrite(
      [
        'Return-Path: <bounce@example.com>',
        'DKIM-Signature: v=1; a=rsa-sha256; d=example.com;',
        'Sender: relay@example.com',
        'Message-ID: <abc@example.com>',
        'From: jane@example.com',
        'Subject: Hello',
        '',
        'Body',
      ].join('\r\n'),
    );

    expect(result).not.toContain('Return-Path:');
    expect(result).not.toContain('DKIM-Signature:');
    expect(result).not.toContain('Sender:');
    expect(result).not.toContain('Message-ID:');
  });

  it('leaves the body untouched, including blank lines', () => {
    const result = rewrite(
      ['From: jane@example.com', 'Subject: Hello', '', 'First line', '', 'Second line'].join(
        '\r\n',
      ),
    );

    expect(result.endsWith('First line\r\n\r\nSecond line')).toBe(true);
  });

  it('round-trips arbitrary body bytes when the message is handled as latin1', () => {
    const bodyBytes = Buffer.from([0xff, 0xfe, 0x00, 0x80, 0xd0, 0x9f]);
    const raw = `From: jane@example.com\r\n\r\n${bodyBytes.toString('latin1')}`;

    const out = Buffer.from(rewrite(raw), 'latin1');

    expect(out.subarray(out.length - bodyBytes.length)).toEqual(bodyBytes);
  });

  it('keeps folded header continuation lines attached to their header', () => {
    const result = rewrite(
      [
        'From: jane@example.com',
        'Subject: A very long subject',
        '\tthat continues here',
        '',
        'Body',
      ].join('\r\n'),
    );

    expect(result).toContain('Subject: A very long subject\r\n\tthat continues here');
  });

  it('RFC 2047 encodes a non-ASCII display name from its original UTF-8 bytes', () => {
    const raw = asLatin1(['From: Ярослав <y@example.com>', 'Subject: Hi', '', 'Body'].join('\r\n'));

    const result = rewrite(raw);
    const encoded = result.match(
      /^From: =\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?= <privacy@techtokapp\.eu>$/m,
    );

    expect(encoded).not.toBeNull();
    expect(Buffer.from(encoded?.[1] ?? '', 'base64').toString('utf8')).toBe(
      'Ярослав <y@example.com> (via TechTok)',
    );
  });

  it('strips quotes from a display name so the rewritten header stays parseable', () => {
    const result = rewrite(
      ['From: "Jane \\"JD\\" Doe" <jane@example.com>', '', 'Body'].join('\r\n'),
    );

    expect(result).toContain(
      'From: "Jane JD Doe <jane@example.com> (via TechTok)" <privacy@techtokapp.eu>',
    );
  });

  it('handles a message with headers but no body', () => {
    const result = rewrite('From: jane@example.com\r\nSubject: Hello');

    expect(result).toContain('From: "jane@example.com (via TechTok)" <privacy@techtokapp.eu>');
    expect(result.endsWith('\r\n\r\n')).toBe(true);
  });
});

describe('pickFromAddress', () => {
  it('uses the matched recipient on the mail domain as the sending address', () => {
    expect(
      pickFromAddress(['Support@TechTokApp.eu'], 'techtokapp.eu', 'postmaster@techtokapp.eu'),
    ).toBe('Support@TechTokApp.eu');
  });

  it('falls back when no recipient is on the mail domain', () => {
    expect(pickFromAddress(['someone@else.org'], 'techtokapp.eu', 'postmaster@techtokapp.eu')).toBe(
      'postmaster@techtokapp.eu',
    );
    expect(pickFromAddress(undefined, 'techtokapp.eu', 'postmaster@techtokapp.eu')).toBe(
      'postmaster@techtokapp.eu',
    );
  });
});

describe('buildOversizeNotice', () => {
  const notice = buildOversizeNotice({
    fromAddress: FROM_ADDRESS,
    forwardTo: 'me@gmail.com',
    originalFrom: 'Ярослав <y@example.com>',
    subject: 'Скриншоты',
    sizeBytes: 12 * 1024 * 1024,
    s3Uri: 's3://bucket/inbound/abc',
  });

  it('is pure ASCII so it survives a latin1 byte round-trip', () => {
    expect(notice).toMatch(/^[\x20-\x7e\r\n]*$/);
  });

  it('encodes the non-ASCII subject and names the S3 location in the body', () => {
    const subject = notice.match(/^Subject: =\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=$/m);
    expect(Buffer.from(subject?.[1] ?? '', 'base64').toString('utf8')).toBe('[oversize] Скриншоты');

    const body = (notice.split('\r\n\r\n')[1] ?? '').replace(/\r\n/g, '');
    const decoded = Buffer.from(body, 'base64').toString('utf8');
    expect(decoded).toContain('12.0 MB message from Ярослав <y@example.com>');
    expect(decoded).toContain('s3://bucket/inbound/abc');
  });
});
