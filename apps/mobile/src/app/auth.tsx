import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing, type ThemeColors, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { useAuthStore } from '@/state/authStore';
import { isE2eAuthEnabled } from '@/state/e2eAuth';

/**
 * Sign-in gate (D68) — rendered by `_layout.tsx`'s `Stack.Protected` for
 * every signed-out user, before any other screen. There is no skip/guest
 * path: the whole app requires a Google account as of this stage.
 */
export default function AuthScreen() {
  const strings = useStrings();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const signIn = useAuthStore((state) => state.signIn);
  const signInWithIdToken = useAuthStore((state) => state.signInWithIdToken);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [hasError, setHasError] = useState(false);

  // E2E-only entry point (see state/e2eAuth.ts): the Maestro suite deep-links
  // to `techtok://auth?idToken=<a real Google ID token>` to skip a consent UI
  // that cannot be automated. Inert in every shipping build — the param is
  // simply ignored, and `signInWithIdToken` no-ops on top of that.
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'space-between',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.four,
    },
    title: {
      color: colors.text,
      ...Typography.xl,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: Spacing.two,
    },
    subtitle: {
      color: colors.textSecondary,
      ...Typography.base,
      textAlign: 'center',
    },
    error: {
      color: colors.error,
      ...Typography.base,
      textAlign: 'center',
      marginTop: Spacing.three,
    },
    cta: {
      margin: Spacing.four,
      borderRadius: Radius.md,
    },
  });
}
