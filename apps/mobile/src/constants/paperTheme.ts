import { DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme } from 'expo-router';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import { buildMD3Colors } from '@/constants/materialTheme';

const lightColors = buildMD3Colors('light');
const darkColors = buildMD3Colors('dark');

export const techtokLightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: lightColors,
};

export const techtokDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: darkColors,
};

export const techtokNavigationLightTheme = {
  ...NavDefaultTheme,
  colors: {
    ...NavDefaultTheme.colors,
    primary: lightColors.primary,
    background: lightColors.background,
    card: lightColors.surface,
    text: lightColors.onSurface,
    border: lightColors.outline,
    notification: lightColors.error,
  },
};

export const techtokNavigationDarkTheme = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    primary: darkColors.primary,
    background: darkColors.background,
    card: darkColors.surface,
    text: darkColors.onSurface,
    border: darkColors.outline,
    notification: darkColors.error,
  },
};
