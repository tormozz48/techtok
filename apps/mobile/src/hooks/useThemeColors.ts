import { useColorScheme } from 'react-native';
import { Colors, type ThemeColors } from '@/constants/theme';
import { useThemeStore } from '@/state/themeStore';

export function useThemeColors(): ThemeColors {
  const systemScheme = useColorScheme();
  const mode = useThemeStore((state) => state.mode);
  const resolved = mode === 'system' ? systemScheme : mode;
  return resolved === 'dark' ? Colors.dark : Colors.light;
}
