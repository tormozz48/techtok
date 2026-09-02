import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable } from 'react-native';

export interface LinkProps {
  href: unknown;
  asChild?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Link({ href, asChild, children, ...rest }: LinkProps) {
  const onPress = () => console.log('[storybook] expo-router Link ->', href);
  if (asChild && isValidElement(children)) {
    return cloneElement(children as ReactElement<{ onPress?: () => void }>, { onPress, ...rest });
  }
  return (
    <Pressable onPress={onPress} {...rest}>
      {children}
    </Pressable>
  );
}

export const router = {
  push: (target: unknown) => console.log('[storybook] expo-router router.push ->', target),
  replace: (target: unknown) => console.log('[storybook] expo-router router.replace ->', target),
  back: () => console.log('[storybook] expo-router router.back()'),
};

export function useLocalSearchParams<T = Record<string, string>>(): T {
  return {} as T;
}
