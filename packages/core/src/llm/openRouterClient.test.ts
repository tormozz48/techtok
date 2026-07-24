import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenRouterProvider } from './openRouterClient';

describe('createOpenRouterProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the message content on a successful response', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'hello' } }] }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = createOpenRouterProvider('test-key', 'anthropic/claude-haiku-4.5');
    const result = await provider.complete('a prompt');

    expect(result).toBe('hello');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body).toEqual({
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: 'a prompt' }],
    });
  });

  it('throws when the response is not OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );

    const provider = createOpenRouterProvider('test-key', 'anthropic/claude-haiku-4.5');

    await expect(provider.complete('a prompt')).rejects.toThrow(
      'OpenRouter request failed with status 500',
    );
  });

  it('throws when the response has no choices', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })),
    );

    const provider = createOpenRouterProvider('test-key', 'anthropic/claude-haiku-4.5');

    await expect(provider.complete('a prompt')).rejects.toThrow(
      'OpenRouter response contained no text content',
    );
  });

  it('throws when the message content is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 }),
      ),
    );

    const provider = createOpenRouterProvider('test-key', 'anthropic/claude-haiku-4.5');

    await expect(provider.complete('a prompt')).rejects.toThrow(
      'OpenRouter response contained no text content',
    );
  });
});
