import type { LlmProvider } from '../llm.types';
import { createBedrockClient, createBedrockProvider } from './bedrockClient';
import { createOpenRouterProvider } from './openRouterClient';

export interface LlmProviderEnv {
  readonly LLM_PROVIDER?: string;
  readonly OPENROUTER_API_KEY?: string;
  readonly OPENROUTER_MODEL_ID?: string;
  readonly BEDROCK_MODEL_ID?: string;
}

export function createConfiguredLlmProvider(env: LlmProviderEnv): LlmProvider {
  const provider = env.LLM_PROVIDER ?? 'openrouter';

  if (provider === 'bedrock') {
    if (!env.BEDROCK_MODEL_ID) throw new Error('BEDROCK_MODEL_ID is not set');
    return createBedrockProvider(createBedrockClient(), env.BEDROCK_MODEL_ID);
  }

  if (provider !== 'openrouter') {
    throw new Error(`unknown LLM_PROVIDER "${provider}"`);
  }

  if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set');
  if (!env.OPENROUTER_MODEL_ID) throw new Error('OPENROUTER_MODEL_ID is not set');
  return createOpenRouterProvider(env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL_ID);
}
