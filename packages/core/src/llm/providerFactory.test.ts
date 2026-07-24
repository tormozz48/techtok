import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConfiguredLlmProvider } from './providerFactory';

describe('createConfiguredLlmProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to the OpenRouter provider when LLM_PROVIDER is unset', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
            status: 200,
          }),
      ),
    );

    const provider = createConfiguredLlmProvider({
      OPENROUTER_API_KEY: 'test-key',
      OPENROUTER_MODEL_ID: 'anthropic/claude-haiku-4.5',
    });

    await expect(provider.complete('hi')).resolves.toBe('ok');
  });

  it('throws when OpenRouter is selected but the API key is missing', () => {
    expect(() =>
      createConfiguredLlmProvider({ OPENROUTER_MODEL_ID: 'anthropic/claude-haiku-4.5' }),
    ).toThrow('OPENROUTER_API_KEY is not set');
  });

  it('throws when OpenRouter is selected but the model id is missing', () => {
    expect(() => createConfiguredLlmProvider({ OPENROUTER_API_KEY: 'test-key' })).toThrow(
      'OPENROUTER_MODEL_ID is not set',
    );
  });

  it('switches to the Bedrock provider when LLM_PROVIDER=bedrock', () => {
    expect(() =>
      createConfiguredLlmProvider({
        LLM_PROVIDER: 'bedrock',
        BEDROCK_MODEL_ID: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
      }),
    ).not.toThrow();
  });

  it('throws when Bedrock is selected but the model id is missing', () => {
    expect(() => createConfiguredLlmProvider({ LLM_PROVIDER: 'bedrock' })).toThrow(
      'BEDROCK_MODEL_ID is not set',
    );
  });

  it('throws on an unknown LLM_PROVIDER value', () => {
    expect(() => createConfiguredLlmProvider({ LLM_PROVIDER: 'openai' })).toThrow(
      'unknown LLM_PROVIDER "openai"',
    );
  });
});
