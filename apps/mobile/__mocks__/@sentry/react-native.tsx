import type { ReactNode } from 'react';

export const reactNavigationIntegration = jest.fn().mockReturnValue({});
export const init = jest.fn();
export const captureMessage = jest.fn();
export const captureException = jest.fn();
export const wrap = jest.fn((component) => component);
export function ErrorBoundary({ children }: { children: ReactNode }) {
  return children;
}
