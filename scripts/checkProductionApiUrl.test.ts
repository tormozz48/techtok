import { describe, expect, it } from 'vitest';
import { checkApiUrl } from './checkProductionApiUrl';

describe('checkApiUrl', () => {
  it('rejects an unset value', () => {
    expect(checkApiUrl(undefined).ok).toBe(false);
  });

  it('rejects an empty/whitespace value', () => {
    expect(checkApiUrl('   ').ok).toBe(false);
  });

  it('rejects the docs/DISTRIBUTION.md placeholder', () => {
    const result = checkApiUrl('https://your-api-id.execute-api.eu-central-1.amazonaws.com');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/placeholder/);
  });

  it('rejects a URL in the wrong region', () => {
    const result = checkApiUrl('https://abc123xyz.execute-api.us-east-1.amazonaws.com');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/eu-central-1/);
  });

  it('rejects a URL with a path', () => {
    expect(checkApiUrl('https://abc123xyz.execute-api.eu-central-1.amazonaws.com/prod').ok).toBe(
      false,
    );
  });

  it('rejects a non-API-Gateway host', () => {
    expect(checkApiUrl('https://api.example.com').ok).toBe(false);
  });

  it('accepts a well-formed eu-central-1 API Gateway URL', () => {
    expect(checkApiUrl('https://abc123xyz.execute-api.eu-central-1.amazonaws.com').ok).toBe(true);
  });
});
