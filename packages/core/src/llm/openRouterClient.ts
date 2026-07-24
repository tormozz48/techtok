import type { LlmProvider } from '../llm.types';

const OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterChatCompletion {
  readonly choices?: ReadonlyArray<{ readonly message?: { readonly content?: string } }>;
}

export function createOpenRouterProvider(apiKey: string, model: string): LlmProvider {
  return {
    async complete(prompt: string): Promise<string> {
      const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!response.ok) {
        throw new Error(`OpenRouter request failed with status ${response.status}`);
      }
      const body = (await response.json()) as OpenRouterChatCompletion;
      const text = body.choices?.[0]?.message?.content;
      if (!text) throw new Error('OpenRouter response contained no text content');
      return text;
    },
  };
}
