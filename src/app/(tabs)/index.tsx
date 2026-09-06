import { TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/features/auth/context/auth-context';
import { signOut } from '@/features/auth/services/auth.service';

export default function Index() {
  const { user } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Chaski</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.email}>
        {user?.email}
      </ThemedText>
      <TouchableOpacity style={styles.button} onPress={() => router.push('/places' as any)}>
        <ThemedText type="default" style={styles.buttonText}>
          Ver lugares
        </ThemedText>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => router.push('/preferences' as any)}>
        <ThemedText type="default" style={styles.buttonText}>
          Ver preferencias
        </ThemedText>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.logout]} onPress={() => signOut()}>
        <ThemedText type="default" style={styles.buttonText}>
          Cerrar sesion
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  email: {
    marginBottom: 16,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3c87f7',
    borderRadius: 8,
  },
  logout: {
    backgroundColor: '#e53935',
  },
  buttonText: {
    color: '#ffffff',
  },
});
