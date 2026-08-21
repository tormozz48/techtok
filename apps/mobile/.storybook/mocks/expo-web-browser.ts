export interface WebBrowserResult {
  type: 'cancel' | 'dismiss';
}

export async function openBrowserAsync(url: string): Promise<WebBrowserResult> {
  console.log('[storybook] expo-web-browser openBrowserAsync ->', url);
  return { type: 'dismiss' };
}
