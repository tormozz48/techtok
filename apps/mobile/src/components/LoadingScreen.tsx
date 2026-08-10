import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * In-app loading screen (DESIGN §2 D25, theme-aware per D56): shown between
 * the native splash screen and the first rendered feed page — while the very
 * first fetch is in flight (cold start), and while FeedScreen's `isRestoring`
 * gate is true (warm start). The latter matters because restoring the
 * persisted cache from AsyncStorage isn't instant, and `isLoading` stays
 * false the whole time (fetches are paused during restore) — without this
 * gate the feed's empty state flashes before the restored cards appear.
 */
export function LoadingScreen() {
  const colors = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
        // Relative path, not the `@/assets/*` tsconfig alias: that alias
        // isn't wired into Jest's moduleNameMapper (only `@/*` -> src/ is),
        // and this is the app's first local asset import, so it's untested
        // in Metro too — safer to rely on a plain path that works everywhere.
        source={require('../../assets/images/splash-icon.png')}
        style={styles.logo}
        contentFit="contain"
      />
      <Text style={[styles.title, { color: colors.text }]}>TechTok</Text>
      <ActivityIndicator color={colors.primary} size="large" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    // Explicit height rather than an `aspectRatio` derived from the source
    // asset's own dimensions — the source is a fixed 228x228 square, and a
    // fixed box avoids relying on layout-time aspect-ratio resolution.
    width: 76,
    height: 76,
    marginBottom: Spacing.four,
  },
  title: {
    ...Typography.xl,
    fontWeight: '700',
    marginBottom: Spacing.four,
  },
  spinner: {
    marginTop: Spacing.two,
  },
});
