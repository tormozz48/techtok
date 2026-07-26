import { buildMD3Colors } from '@/constants/materialTheme';

const light = buildMD3Colors('light');
const dark = buildMD3Colors('dark');

export const Colors = {
  light: {
    text: light.onSurface,
    background: light.surface,
    backgroundElement: light.surfaceVariant,
    backgroundSelected: light.primaryContainer,
    textSecondary: light.onSurfaceVariant,
    primary: light.primary,
    error: light.error,
  },
  dark: {
    text: dark.onSurface,
    background: dark.surface,
    backgroundElement: dark.surfaceVariant,
    backgroundSelected: dark.primaryContainer,
    textSecondary: dark.onSurfaceVariant,
    primary: dark.primary,
    error: dark.error,
  },
  // Scheme-independent palette for the full-bleed photo-card overlay (Card.tsx),
  // which always renders dark scrim + light text regardless of system theme.
  overlay: {
    text: '#ffffff',
    textMuted: '#E0E1E6',
    textSecondary: '#B0B4BA',
    accent: dark.primary,
    surfaceBlack: '#000000',
    surfaceDim: '#1a1a1a',
    chipBackground: 'rgba(255,255,255,0.15)',
    scrimStart: 'transparent',
    scrimEnd: 'rgba(0,0,0,0.85)',
    debugBackground: 'rgba(255,196,0,0.85)',
    debugText: '#000000',
  },
} as const;

/** The scheme-dependent half of the palette — Colors.light and Colors.dark
 * share this exact shape (see useThemeColors). */
export type ThemeColors = typeof Colors.dark;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  md: 12,
} as const;

export const Typography = {
  xs: { fontSize: 11, lineHeight: 14 },
  sm: { fontSize: 13, lineHeight: 18 },
  base: { fontSize: 14, lineHeight: 20 },
  md: { fontSize: 16, lineHeight: 22 },
  lg: { fontSize: 18, lineHeight: 24 },
  xl: { fontSize: 24, lineHeight: 30 },
  xxl: { fontSize: 32, lineHeight: 44 },
  xxxl: { fontSize: 48, lineHeight: 52 },
} as const;

export const FontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;
