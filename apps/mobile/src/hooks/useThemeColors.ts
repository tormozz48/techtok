import { useColorScheme } from 'react-native';
import { Colors, type ThemeColors } from '@/constants/theme';
import { useThemeStore } from '@/state/themeStore';

/** Resolves the scheme-dependent half of the palette (Colors.light/dark).
 * Defaults to following the device's color scheme, but a user's explicit
 * light/dark choice in Settings (themeStore) overrides it — matching the
 * same resolution _layout.tsx uses for the Paper/navigation themes so
 * chrome screens never disagree with the Paper components around them.
 * Screens compose this with the always-fixed Colors.overlay palette where
 * needed (Card's full-bleed photo overlay, BottomActionBar — neither of
 * which switch with system theme). LoadingScreen (D56) now uses this hook
 * directly instead of a fixed splash-matching color. */
export function useThemeColors(): ThemeColors {
  const systemScheme = useColorScheme();
  const mode = useThemeStore((state) => state.mode);
  const resolved = mode === 'system' ? systemScheme : mode;
  return resolved === 'dark' ? Colors.dark : Colors.light;
}
