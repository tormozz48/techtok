import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { LlmProvider } from '../llm.types';

export function createBedrockClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({});
}

export function createBedrockProvider(client: BedrockRuntimeClient, modelId: string): LlmProvider {
  return {
    async complete(prompt: string): Promise<string> {
      const result = await client.send(
        new ConverseCommand({
          modelId,
          messages: [{ role: 'user', content: [{ text: prompt }] }],
        }),
      );
      const text = result.output?.message?.content?.find((block) => block.text)?.text;
      if (!text) throw new Error('Bedrock response contained no text content');
      return text;
    },
  };
}
