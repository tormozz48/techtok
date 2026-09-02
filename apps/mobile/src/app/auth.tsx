import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { useAuthStore } from '@/state/authStore';
import { isE2eAuthEnabled } from '@/state/e2eAuth';
import { createStyles } from './auth.styles';

export default function AuthScreen() {
  const strings = useStrings();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const signIn = useAuthStore((state) => state.signIn);
  const signInWithIdToken = useAuthStore((state) => state.signInWithIdToken);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [hasError, setHasError] = useState(false);

  const { idToken } = useLocalSearchParams<{ idToken?: string }>();
  useEffect(() => {
    if (isE2eAuthEnabled() && idToken) signInWithIdToken(idToken);
  }, [idToken, signInWithIdToken]);

  const handleSignIn = async () => {
    setHasError(false);
    setIsSigningIn(true);
    try {
      await signIn();
    } catch {
      setHasError(true);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <View style={styles.container} testID="auth-screen">
      <View style={styles.content}>
        <Text style={styles.title}>{strings.auth.title}</Text>
        <Text style={styles.subtitle}>{strings.auth.subtitle}</Text>
        {hasError ? <Text style={styles.error}>{strings.auth.error}</Text> : null}
      </View>
      <Button
        mode="contained"
        onPress={handleSignIn}
        loading={isSigningIn}
        disabled={isSigningIn}
        style={[styles.cta, { marginBottom: Spacing.four + insets.bottom }]}
      >
        {isSigningIn ? strings.auth.signingIn : strings.auth.signInCta}
      </Button>
    </View>
  );
}
