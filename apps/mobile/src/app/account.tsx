import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { deleteAccount } from '@/api/client';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { useAuthStore } from '@/state/authStore';
import { createStyles } from './account.styles';

export default function AccountScreen() {
  const strings = useStrings();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasDeleteError, setHasDeleteError] = useState(false);

  const confirmDelete = () => {
    Alert.alert(
      strings.account.deleteAccountConfirmTitle,
      strings.account.deleteAccountConfirmMessage,
      [
        { text: strings.account.cancel, style: 'cancel' },
        { text: strings.account.deleteAccountConfirmCta, style: 'destructive', onPress: runDelete },
      ],
    );
  };

  const runDelete = async () => {
    setHasDeleteError(false);
    setIsDeleting(true);
    try {
      await deleteAccount();
      await signOut();
    } catch {
      setHasDeleteError(true);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      {user?.email ? (
        <Text style={styles.email}>{strings.account.signedInAs(user.email)}</Text>
      ) : null}

      <Button
        mode="outlined"
        onPress={() => signOut()}
        style={styles.button}
        testID="account-sign-out"
      >
        {strings.account.signOut}
      </Button>

      <Button
        mode="text"
        textColor={colors.error}
        onPress={confirmDelete}
        loading={isDeleting}
        disabled={isDeleting}
        style={styles.button}
        testID="account-delete"
      >
        {strings.account.deleteAccount}
      </Button>

      {hasDeleteError ? (
        <Text style={styles.error}>{strings.account.deleteAccountError}</Text>
      ) : null}
    </View>
  );
}
