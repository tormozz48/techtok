import {
  argbFromHex,
  Hct,
  hexFromArgb,
  TonalPalette,
  themeFromSourceColor,
} from '@material/material-color-utilities';

// Brand seeds from the app icon (DESIGN §2 D37, "Orbit"): navy background,
// amber ring-and-dot mark. The navy seed drives the neutral/secondary/
// tertiary/error palettes (M3's algorithm desaturates a seed hue into
// harmonious supporting tones); the amber seed is swapped in as its own
// primary palette so brand actions/accents read as amber, not navy-derived.
const NAVY_SEED = '#111A33';
const AMBER_SEED = '#FF9F1C';

const seeded = themeFromSourceColor(argbFromHex(NAVY_SEED));
const amberHct = Hct.fromInt(argbFromHex(AMBER_SEED));

const palettes = {
  primary: TonalPalette.fromHueAndChroma(amberHct.hue, amberHct.chroma),
  secondary: seeded.palettes.secondary,
  tertiary: seeded.palettes.tertiary,
  error: seeded.palettes.error,
  neutral: seeded.palettes.neutral,
  neutralVariant: seeded.palettes.neutralVariant,
};

function tone(palette: TonalPalette, t: number): string {
  return hexFromArgb(palette.tone(t));
}

function rgba(hex: string, alpha: number): string {
  const argb = argbFromHex(hex);
  const r = (argb >> 16) & 0xff;
  const g = (argb >> 8) & 0xff;
  const b = argb & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Pre-blends `fg` over `bg` into a solid color, matching Paper's own stock
// MD3 themes: RN transfers shadows to children instead of the Surface view
// when the elevation "tint" carries transparency, so it must be opaque.
function mix(fgHex: string, bgHex: string, alpha: number): string {
  const fg = argbFromHex(fgHex);
  const bg = argbFromHex(bgHex);
  const blend = (shift: number) => {
    const f = (fg >> shift) & 0xff;
    const b = (bg >> shift) & 0xff;
    return Math.round(f * alpha + b * (1 - alpha));
  };
  return `rgb(${blend(16)}, ${blend(8)}, ${blend(0)})`;
}

export type ThemeTone = 'light' | 'dark';

// Standard M3 tone-role mapping (the same tone numbers stock Paper's
// MD3LightTheme/MD3DarkTheme use) applied to our own seeded palettes.
export function buildMD3Colors(themeTone: ThemeTone) {
  const isDark = themeTone === 'dark';
  const t = (light: number, dark: number) => (isDark ? dark : light);

  const surface = tone(palettes.neutral, t(99, 10));
  const onSurface = tone(palettes.neutral, t(10, 90));
  const primary = tone(palettes.primary, t(40, 80));

  return {
    primary,
    onPrimary: tone(palettes.primary, t(100, 20)),
    primaryContainer: tone(palettes.primary, t(90, 30)),
    onPrimaryContainer: tone(palettes.primary, t(10, 90)),
    secondary: tone(palettes.secondary, t(40, 80)),
    onSecondary: tone(palettes.secondary, t(100, 20)),
    secondaryContainer: tone(palettes.secondary, t(90, 30)),
    onSecondaryContainer: tone(palettes.secondary, t(10, 90)),
    tertiary: tone(palettes.tertiary, t(40, 80)),
    onTertiary: tone(palettes.tertiary, t(100, 20)),
    tertiaryContainer: tone(palettes.tertiary, t(90, 30)),
    onTertiaryContainer: tone(palettes.tertiary, t(10, 90)),
    error: tone(palettes.error, t(40, 80)),
    onError: tone(palettes.error, t(100, 20)),
    errorContainer: tone(palettes.error, t(90, 30)),
    onErrorContainer: tone(palettes.error, t(10, 90)),
    background: surface,
    onBackground: onSurface,
    surface,
    onSurface,
    surfaceVariant: tone(palettes.neutralVariant, t(90, 30)),
    onSurfaceVariant: tone(palettes.neutralVariant, t(30, 80)),
    surfaceDisabled: rgba(onSurface, 0.12),
    onSurfaceDisabled: rgba(onSurface, 0.38),
    outline: tone(palettes.neutralVariant, t(50, 60)),
    outlineVariant: tone(palettes.neutralVariant, t(80, 30)),
    inverseSurface: tone(palettes.neutral, t(20, 90)),
    inverseOnSurface: tone(palettes.neutral, t(95, 20)),
    inversePrimary: tone(palettes.primary, t(80, 40)),
    shadow: tone(palettes.neutral, 0),
    scrim: tone(palettes.neutral, 0),
    backdrop: rgba(tone(palettes.neutralVariant, 20), 0.4),
    elevation: {
      level0: 'transparent',
      level1: mix(primary, surface, 0.05),
      level2: mix(primary, surface, 0.08),
      level3: mix(primary, surface, 0.11),
      level4: mix(primary, surface, 0.12),
      level5: mix(primary, surface, 0.14),
    },
  };
}
