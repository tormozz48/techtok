import { useColorScheme } from 'react-native';
import { Colors, type ThemeColors } from '@/constants/theme';

/** Resolves the scheme-dependent half of the palette (Colors.light/dark) to
 * the device's current color scheme, matching the same fallback _layout.tsx
 * uses for the Paper/navigation themes (anything but exactly 'dark' -> light)
 * so chrome screens never disagree with the Paper components around them.
 * Screens compose this with the always-fixed Colors.overlay palette where
 * needed (Card's full-bleed photo overlay, BottomActionBar, LoadingScreen's
 * splash continuation — none of which switch with system theme). */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
}
