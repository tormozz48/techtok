import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

export function LoadingScreen() {
  const colors = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
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
