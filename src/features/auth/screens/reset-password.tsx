import { useEffect, useState } from 'react';
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
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';

import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/context/auth-context';
import { signOut, updatePassword } from '@/features/auth/services/auth.service';
import { validatePasswordChange } from '@/features/auth/utils/password-validation';
import {
  canProcessPayload,
  getRecoveryFingerprint,
  hasRecoveryPayload,
  markPayloadFailed,
  markPayloadInFlight,
  markPayloadSuccess,
  parseRecoveryUrl,
  processRecoveryLink,
  type ParsedRecoveryParams,
} from '@/features/auth/utils/recovery-link';

/**
 * Pantalla para procesar enlaces de recuperación y definir la nueva contraseña.
 * Solo permite establecer la nueva contraseña tras validar un enlace de recuperación legítimo.
 * No acepta sesiones normales existentes para acceder al formulario.
 */
export function ResetPasswordScreen() {
  const { isPasswordRecovery, setIsPasswordRecovery } = useAuth();
  const incomingUrl = Linking.useURL();
  const searchParams = useLocalSearchParams<{
    code?: string;
    token_hash?: string;
    type?: string;
    error?: string;
    error_description?: string;
  }>();

  // Estados de flujo y verificación
  const [processing, setProcessing] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function handleIncomingRecovery() {
      // 1. Si el contexto ya verificó el evento PASSWORD_RECOVERY
      if (isPasswordRecovery && isVerified) {
        if (isMounted) {
          setProcessing(false);
        }
        return;
      }

      // 2. Extraer parámetros desde URL completa o searchParams de Expo Router
      const urlParsed = parseRecoveryUrl(incomingUrl);

      const paramsCombined: ParsedRecoveryParams = {
        code: urlParsed.code || searchParams.code,
        tokenHash: urlParsed.tokenHash || searchParams.token_hash,
        type: urlParsed.type || searchParams.type,
        accessToken: urlParsed.accessToken,
        refreshToken: urlParsed.refreshToken,
        error: urlParsed.error || searchParams.error,
        errorDescription: urlParsed.errorDescription || searchParams.error_description,
      };

      if (!hasRecoveryPayload(paramsCombined)) {
        // Enlace sin carga útil de recuperación y sin sesión de recuperación previa
        if (isMounted) {
          setIsVerified(false);
          setProcessing(false);
          setError(
            'No se detectó un enlace de recuperación válido. Para restablecer tu contraseña, solicita un nuevo enlace.',
          );
        }
        return;
      }

      const fingerprint = getRecoveryFingerprint(paramsCombined);
      if (fingerprint && !canProcessPayload(fingerprint)) {
        // Bloqueo de concurrencia: ya en curso o exitoso
        return;
      }

      if (fingerprint) {
        markPayloadInFlight(fingerprint);
      }

      if (isMounted) {
        setProcessing(true);
        setError('');
      }

      // Prevenir desmontaje en _layout.tsx durante el canje PKCE
      setIsPasswordRecovery(true);

      try {
        const result = await processRecoveryLink(paramsCombined);

        if (!isMounted) return;

        if (result.success) {
          if (fingerprint) markPayloadSuccess(fingerprint);
          setIsVerified(true);
          setProcessing(false);
        } else {
          if (fingerprint) markPayloadFailed(fingerprint);
          setIsVerified(false);
          setIsPasswordRecovery(false);
          await signOut();
          setError(
            result.error ||
              'El enlace de recuperación es inválido, ha expirado o ya ha sido utilizado.',
          );
          setProcessing(false);
        }
      } catch (err: any) {
        if (fingerprint) markPayloadFailed(fingerprint);
        if (!isMounted) return;
        setIsVerified(false);
        setIsPasswordRecovery(false);
        await signOut();
        setError(
          err?.message ||
            'Error al procesar el enlace de recuperación. Comprueba tu conexión e intenta nuevamente.',
        );
        setProcessing(false);
      }
    }

    handleIncomingRecovery();

    return () => {
      isMounted = false;
    };
  }, [incomingUrl, searchParams, isPasswordRecovery, isVerified, setIsPasswordRecovery]);

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
      // Limpiar datos sensibles de la memoria
      setNewPassword('');
      setConfirmPassword('');
      // Inmediatamente cerramos la sesión temporal de recuperación en Supabase
      await signOut();
      setLoading(false);
      setSuccess(true);
    }
  };

  const handleFinishAndLogin = async () => {
    setIsPasswordRecovery(false);
    await signOut();
    router.replace('/login');
  };

  const handleExitToLogin = async () => {
    setIsPasswordRecovery(false);
    await signOut();
    router.replace('/login');
  };

  const handleExitToForgotPassword = async () => {
    setIsPasswordRecovery(false);
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
                    style={styles.primaryButton}
                    onPress={handleFinishAndLogin}
                  >
                    <Text style={styles.primaryButtonText}>INICIAR SESIÓN</Text>
                  </TouchableOpacity>
                </View>
              ) : !isVerified ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleExitToForgotPassword}
                  >
                    <Text style={styles.primaryButtonText}>SOLICITAR NUEVO ENLACE</Text>
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
