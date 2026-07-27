// Storybook renders on the web. expo-web-browser's JS wrapper calls
// requireNativeModule('ExpoWebBrowser') at import time with no `.web`
// module registered, which throws synchronously and would take down every
// story that imports it (same class of gap as expo-router, see
// .storybook/mocks/expo-router.tsx). This mock covers only the export
// post/[id].tsx actually touches.

export interface WebBrowserResult {
  type: 'cancel' | 'dismiss';
}

export async function openBrowserAsync(url: string): Promise<WebBrowserResult> {
  console.log('[storybook] expo-web-browser openBrowserAsync ->', url);
  return { type: 'dismiss' };
}
