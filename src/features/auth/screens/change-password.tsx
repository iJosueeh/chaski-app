import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/context/auth-context';
import { updatePassword } from '@/features/auth/services/auth.service';
import { validatePasswordChange } from '@/features/auth/utils/password-validation';

/**
 * Pantalla autenticada para el cambio de contraseña de usuario en Chaski.
 * Respeta la identidad visual de boleto/pergamino Serie AX.
 * No persiste contraseñas en almacenamiento persistente ni emite logs sensibles.
 */
export function ChangePasswordScreen() {
  const { session } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading || success) return;

    if (!session) {
      setError('Tu sesión ha expirado. Por favor, vuelve a iniciar sesión.');
      return;
    }

    const validation = validatePasswordChange(newPassword, confirmPassword);
    if (!validation.isValid) {
      setError(validation.error ?? 'Datos inválidos');
      return;
    }

    setLoading(true);
    setError('');

    const { error: authError } = await updatePassword(newPassword);

    if (authError) {
      // Manejar posibles respuestas de seguridad de Supabase
      if (
        authError.message.toLowerCase().includes('reauthentication') ||
        authError.message.toLowerCase().includes('recent login')
      ) {
        setError(
          'Por seguridad, Supabase requiere que vuelvas a iniciar sesión antes de cambiar tu contraseña.',
        );
      } else {
        setError(authError.message);
      }
      setLoading(false);
    } else {
      // Éxito: limpiar campos de contraseña inmediatamente de la memoria
      setNewPassword('');
      setConfirmPassword('');
      setLoading(false);
      setSuccess(true);
    }
  };

  return (
    <View style={styles.canvas}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tarjeta de Boleto / Serie AX */}
          <View style={styles.ticket}>
            {/* Cabecera del boleto */}
            <View style={styles.ticketHeader}>
              <Text style={styles.brand}>CHASKI</Text>
              <Text style={styles.serie}>SEGURIDAD DE CUENTA · SERIE AX</Text>
            </View>

            <View style={styles.goldRule} />

            <View style={styles.ticketBody}>
              <Text style={styles.title}>Cambiar Contraseña</Text>
              <Text style={styles.subtitle}>
                Actualiza tu clave de acceso para mantener tu cuenta segura.
              </Text>

              {success ? (
                <View style={styles.successBox}>
                  <Text style={styles.successIcon}>✓</Text>
                  <Text style={styles.successTitle}>¡Contraseña Actualizada!</Text>
                  <Text style={styles.successText}>
                    Tu contraseña ha sido modificada exitosamente en Supabase Auth.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => router.back()}
                  >
                    <Text style={styles.primaryButtonText}>VOLVER AL PERFIL</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.form}>
                  <Text style={styles.inputLabel}>NUEVA CONTRASEÑA</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={Colors.light.textSecondary}
                    value={newPassword}
                    onChangeText={(val) => {
                      setNewPassword(val);
                      if (error) setError('');
                    }}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />

                  <Text style={styles.inputLabel}>CONFIRMAR NUEVA CONTRASEÑA</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Repite la nueva contraseña"
                    placeholderTextColor={Colors.light.textSecondary}
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      if (error) setError('');
                    }}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity
                    style={[styles.primaryButton, { opacity: loading ? 0.6 : 1 }]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={Colors.light.surface} />
                    ) : (
                      <Text style={styles.primaryButtonText}>ACTUALIZAR CONTRASEÑA</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => router.back()}
                    disabled={loading}
                  >
                    <Text style={styles.cancelButtonText}>CANCELAR</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.goldRule} />

            <View style={styles.ticketFooter}>
              <Text style={styles.folio}>
                EMPRESA DE TRANSPORTES CHASKI · CREDENCIALES SEGURAS
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  ticket: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.light.shadowStrong,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
    overflow: 'hidden',
  },
  ticketHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  brand: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 5,
    color: Colors.light.brand,
  },
  serie: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  goldRule: {
    height: 2,
    backgroundColor: Colors.light.accent,
    opacity: 0.7,
  },
  ticketBody: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  form: {
    gap: 12,
  },
  inputLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.light.brand,
    marginTop: 4,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Fonts.sans,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.carmine,
    marginTop: 4,
    lineHeight: 18,
  },
  primaryButton: {
    height: 48,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: Colors.light.surface,
  },
  cancelButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.light.textSecondary,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  successIcon: {
    fontSize: 44,
    color: Colors.light.primary,
  },
  successTitle: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.brand,
  },
  successText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  ticketFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.backgroundElement,
    alignItems: 'center',
  },
  folio: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.light.textSecondary,
  },
});
