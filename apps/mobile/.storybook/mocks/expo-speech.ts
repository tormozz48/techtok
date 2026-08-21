export interface SpeechOptions {
  language?: string;
  onStopped?: () => void;
  onDone?: () => void;
  onError?: () => void;
  [key: string]: unknown;
}

export interface Voice {
  identifier: string;
  name: string;
  language: string;
}

export async function getAvailableVoicesAsync(): Promise<Voice[]> {
  return [
    { identifier: 'storybook-en', name: 'Storybook English', language: 'en-US' },
    { identifier: 'storybook-ru', name: 'Storybook Russian', language: 'ru-RU' },
    { identifier: 'storybook-uk', name: 'Storybook Ukrainian', language: 'uk-UA' },
    { identifier: 'storybook-pl', name: 'Storybook Polish', language: 'pl-PL' },
  ];
}

export function speak(_text: string, _options?: SpeechOptions): void {
  console.log('[storybook] expo-speech speak() called');
}

export function stop(): void {
  console.log('[storybook] expo-speech stop() called');
}
