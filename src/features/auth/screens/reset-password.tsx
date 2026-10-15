import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Colors, Fonts } from '@/constants/theme';
import { PasswordField } from '@/features/auth/components/password-field';
import { useAuth } from '@/features/auth/context/auth-context';
import { useRecoveryHandler } from '@/features/auth/hooks';
import { signOut, updatePassword } from '@/features/auth/services/auth.service';
import { validatePasswordChange } from '@/features/auth/utils/password-validation';

export function ResetPasswordScreen() {
  const {
    session,
    isPasswordRecovery,
    setIsPasswordRecovery,
    isRecoveryVerified,
    setIsRecoveryVerified,
  } = useAuth();
  const searchParams = useLocalSearchParams<{
    code?: string;
    token_hash?: string;
    type?: string;
    error?: string;
    error_description?: string;
  }>();

  const { processing, isVerified, error: linkError } = useRecoveryHandler({
    routeParams: searchParams,
    session,
    isPasswordRecovery,
    isRecoveryVerified,
    setIsPasswordRecovery,
    setIsRecoveryVerified,
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading || success || !isVerified) return;

    const validation = validatePasswordChange(newPassword, confirmPassword);
    if (!validation.isValid) {
      setError(validation.error ?? 'Datos inválidos');
      return;
    }

    setLoading(true);
    setError('');

    const { error: authError } = await updatePassword(newPassword);

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      setNewPassword('');
      setConfirmPassword('');
      await signOut();
      setIsPasswordRecovery(false);
      setIsRecoveryVerified(false);
      setLoading(false);
      setSuccess(true);
    }
  };

  const handleFinishAndLogin = async () => {
    setIsPasswordRecovery(false);
    setIsRecoveryVerified(false);
    await signOut();
    router.replace('/login');
  };

  const handleExitToLogin = async () => {
    setIsPasswordRecovery(false);
    setIsRecoveryVerified(false);
    await signOut();
    router.replace('/login');
  };

  const handleExitToForgotPassword = async () => {
    setIsPasswordRecovery(false);
    setIsRecoveryVerified(false);
    await signOut();
    router.replace('/forgot-password');
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
          <View style={styles.ticket}>
            {/* Encabezado del boleto */}
            <View style={styles.ticketHeader}>
              <Text style={styles.brand}>CHASKI</Text>
              <Text style={styles.serie}>RESTABLECER ACCESO · SERIE AX</Text>
            </View>

            <View style={styles.goldRule} />

            <View style={styles.ticketBody}>
              <Text style={styles.title}>Nueva Contraseña</Text>
              <Text style={styles.subtitle}>
                Define una nueva contraseña segura para recuperar el acceso a tu cuenta.
              </Text>

              {processing ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="large" color={Colors.light.primary} />
                  <Text style={styles.centerText}>Verificando enlace de recuperación…</Text>
                </View>
              ) : success ? (
                <View style={styles.successBox}>
                  <Text style={styles.successIcon}>✓</Text>
                  <Text style={styles.successTitle}>¡Contraseña Restablecida!</Text>
                  <Text style={styles.successText}>
                    Tu contraseña ha sido actualizada exitosamente. Ya puedes iniciar sesión con tus nuevas credenciales.
                  </Text>
                  <TouchableOpacity
                    style={styles.successButton}
                    onPress={handleFinishAndLogin}
                    accessibilityRole="button"
                    accessibilityLabel="Iniciar sesión"
                    accessibilityHint="Vuelve a la pantalla de inicio de sesión"
                    activeOpacity={0.85}
                  >
                    <Text style={styles.successButtonText}>INICIAR SESIÓN</Text>
                    <Text style={styles.successButtonArrow}>→</Text>
                  </TouchableOpacity>
                </View>
              ) : !isVerified ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{linkError}</Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleExitToForgotPassword}
                  >
                    <Text style={styles.primaryButtonText}>SOLICITAR NUEVO CÓDIGO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleExitToLogin}
                  >
                    <Text style={styles.cancelButtonText}>VOLVER AL INICIO DE SESIÓN</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.form}>
                  <PasswordField
                    label="NUEVA CONTRASEÑA"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChangeText={(val) => {
                      setNewPassword(val);
                      if (error) setError('');
                    }}
                    showPassword={showNewPassword}
                    onToggleShowPassword={() => setShowNewPassword((prev) => !prev)}
                    accessibilityLabel="Nueva contraseña"
                    accessibilityHint="Ingresa tu nueva contraseña"
                    toggleAccessibilityLabel={showNewPassword ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
                    toggleAccessibilityHint="Alterna la visibilidad de los caracteres de la nueva contraseña"
                    editable={!loading}
                  />

                  <PasswordField
                    label="CONFIRMAR NUEVA CONTRASEÑA"
                    placeholder="Repite la nueva contraseña"
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      if (error) setError('');
                    }}
                    showPassword={showConfirmPassword}
                    onToggleShowPassword={() => setShowConfirmPassword((prev) => !prev)}
                    accessibilityLabel="Confirmar nueva contraseña"
                    accessibilityHint="Repite tu nueva contraseña"
                    toggleAccessibilityLabel={showConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
                    toggleAccessibilityHint="Alterna la visibilidad de los caracteres de la confirmación de contraseña"
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
                      <Text style={styles.primaryButtonText}>ESTABLECER NUEVA CONTRASEÑA</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleFinishAndLogin}
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
                EMPRESA DE TRANSPORTES CHASKI · ASISTENCIA AL PASAJERO
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
  centerBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 16,
  },
  centerText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  form: {
    gap: 12,
  },
  errorBox: {
    paddingVertical: 12,
    gap: 12,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.carmine,
    marginTop: 4,
    lineHeight: 18,
    textAlign: 'center',
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
  successButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    borderWidth: 1,
    borderColor: Colors.light.accent,
    marginTop: 12,
    shadowColor: Colors.light.shadowStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  successButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.light.surface,
  },
  successButtonArrow: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.surface,
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
