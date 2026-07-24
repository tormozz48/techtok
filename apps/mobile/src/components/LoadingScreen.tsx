import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';

// Matches app.json's expo-splash-screen config exactly (background color,
// same logo asset) so this reads as a continuation of the native splash
// rather than a jump to a different screen.
const SPLASH_BACKGROUND_COLOR = '#111A33';
const LOGO_ASPECT_RATIO = 228 / 228;

/**
 * In-app loading screen (DESIGN §2 D25): shown between the native splash
 * screen and the first rendered feed page while that very first fetch is in
 * flight. Cold-start only — a warm start restores the persisted feed cache
 * before `isLoading` ever turns true, so this never flashes on a relaunch.
 */
export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Image
        // Relative path, not the `@/assets/*` tsconfig alias: that alias
        // isn't wired into Jest's moduleNameMapper (only `@/*` -> src/ is),
        // and this is the app's first local asset import, so it's untested
        // in Metro too — safer to rely on a plain path that works everywhere.
        source={require('../../assets/images/splash-icon.png')}
        style={styles.logo}
        contentFit="contain"
      />
      <ActivityIndicator color="#ffffff" size="large" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 76,
    aspectRatio: LOGO_ASPECT_RATIO,
    marginBottom: Spacing.four,
  },
  spinner: {
    marginTop: Spacing.two,
  },
});
