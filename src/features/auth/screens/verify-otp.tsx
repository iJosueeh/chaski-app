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
import { router, useLocalSearchParams } from 'expo-router';

import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/context/auth-context';
import { useOtpVerification, type OtpMode } from '@/features/auth/hooks';
import { normalizeEmail } from '@/features/auth/utils/otp-validation';
import { usePreferences } from '@/features/preferences/context/preferences-context';

/**
 * Franja decorativa de tocapus andinos estilizados (Serie AX).
 */
function AndeanTocapuBand() {
  return (
    <View style={styles.tocapuBand} accessible={false} importantForAccessibility="no">
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuDiamond} />
      </View>
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuSquareInSquare} />
      </View>
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuSteppedCross} />
      </View>
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuDiamondGold} />
      </View>
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuSteppedCross} />
      </View>
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuSquareInSquare} />
      </View>
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuDiamond} />
      </View>
    </View>
  );
}

/**
 * Pantalla de Verificación de Código OTP (Serie AX).
 * Admite dos flujos independientes:
 * 1. 'recovery': Verificación para restablecer contraseña (por defecto, retrocompatible).
 * 2. 'signup': Confirmación de cuenta de nuevo usuario tras registrarse.
 *
 * Principios de seguridad y arquitectura:
 * - No persiste códigos ni credenciales en almacenamiento o logs.
 * - En modo signup: NO activa isPasswordRecovery ni isRecoveryVerified.
 * - En modo recovery: activa isPasswordRecovery y dirige a /reset-password.
 * - Sincroniza la sesión y preferencias antes de navegar hacia onboarding o tabs.
 * - Cooldown de 60s para prevenir abuso y respetar rate limits de Supabase.
 * - Bloquea ejecuciones concurrentes.
 */
export function VerifyOtpScreen() {
  const params = useLocalSearchParams<{ email?: string; mode?: string }>();
  const email = normalizeEmail(params.email);
  const mode: OtpMode = params.mode === 'signup' ? 'signup' : 'recovery';
  const isSignupMode = mode === 'signup';

  const { setIsPasswordRecovery, setIsRecoveryVerified, setSession } = useAuth();
  const { checkPreferences, hasPreferences } = usePreferences();

  const {
    code,
    changeCode,
    loading,
    resending,
    error,
    feedback,
    cooldown,
    verify,
    resend,
  } = useOtpVerification({
    email,
    mode,
    setIsPasswordRecovery,
    setIsRecoveryVerified,
    setSession,
    checkPreferences,
  });

  const handleVerify = async () => {
    // Capturar antes de verificar: la decisión de navegación usa las
    // preferencias vigentes al pulsar (misma semántica que el closure
    // del handler histórico, previa a que checkPreferences actualice el estado).
    const shouldUsePreferences = hasPreferences;
    const outcome = await verify();
    if (outcome.status !== 'success') return;

    // Dirigir al usuario según sus preferencias
    if (isSignupMode) {
      router.replace(shouldUsePreferences ? '/(tabs)' : '/onboarding-categories');
    } else {
      router.replace('/reset-password');
    }
  };

  const handleCancel = () => {
    setIsPasswordRecovery(false);
    setIsRecoveryVerified(false);
    if (isSignupMode) {
      router.replace('/register');
    } else {
      router.replace('/login');
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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.ticket}>
            {/* Encabezado del boleto */}
            <View style={styles.ticketHeader}>
              <Text style={styles.brand}>CHASKI</Text>
              <Text style={styles.serie}>
                {isSignupMode
                  ? 'CONFIRMACIÓN DE PASAJE · SERIE AX'
                  : 'VERIFICACIÓN DE ACCESO · SERIE AX'}
              </Text>
            </View>

            <View style={styles.goldRule} />
            <AndeanTocapuBand />
            <View style={styles.goldRule} />

            <View style={styles.ticketBody}>
              <Text style={styles.title}>
                {isSignupMode ? 'Confirmar Cuenta' : 'Verificar Código'}
              </Text>
              <Text style={styles.subtitle}>
                {isSignupMode
                  ? 'Ingresa el código numérico de 6 dígitos enviado a '
                  : 'Ingresa el código numérico de 6 dígitos enviado a '}
                <Text style={styles.emailHighlight}>{email || 'tu correo'}</Text>
                {isSignupMode
                  ? ' para activar tu cuenta de viajero.'
                  : ' para continuar con la recuperación de tu contraseña.'}
              </Text>

              <View style={styles.form}>
                <Text style={styles.inputLabel}>CÓDIGO DE 6 DÍGITOS</Text>
                <TextInput
                  style={styles.otpInput}
                  placeholder="000000"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={code}
                  onChangeText={changeCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  editable={!loading && !resending}
                  accessible={true}
                  accessibilityLabel="Código de verificación de 6 dígitos"
                  accessibilityHint="Ingresa los seis números recibidos por correo"
                />

                {error ? (
                  <View
                    style={styles.errorBox}
                    accessible={true}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                  >
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {feedback ? (
                  <View
                    style={styles.feedbackBox}
                    accessible={true}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    <Text style={styles.feedbackText}>{feedback}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    { opacity: loading || resending || code.length !== 6 ? 0.6 : 1 },
                  ]}
                  onPress={handleVerify}
                  disabled={loading || resending || code.length !== 6}
                  accessibilityRole="button"
                  accessibilityLabel={isSignupMode ? 'Confirmar cuenta de viajero' : 'Validar boleto de recuperación'}
                  accessibilityState={{ disabled: loading || resending || code.length !== 6, busy: loading }}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.light.surface} />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {isSignupMode ? 'CONFIRMAR CUENTA' : 'VALIDAR BOLETO'}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Sección de Reenvío con Cooldown */}
                <View style={styles.resendSection}>
                  {cooldown > 0 ? (
                    <Text style={styles.cooldownText}>
                      {isSignupMode ? '¿No recibiste el código? ' : '¿No recibiste el boleto? '}
                      Podrás reenviar en <Text style={styles.cooldownSeconds}>{cooldown}s</Text>
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={resend}
                      disabled={resending || loading}
                      style={styles.resendButton}
                      accessibilityRole="button"
                      accessibilityLabel="Reenviar código de verificación"
                    >
                      {resending ? (
                        <ActivityIndicator size="small" color={Colors.light.primary} />
                      ) : (
                        <Text style={styles.resendButtonText}>
                          {isSignupMode ? '¿No recibiste el código? ' : '¿No recibiste el boleto? '}
                          <Text style={styles.resendButtonStrong}>Reenviar código</Text>
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={isSignupMode ? 'Volver al registro' : 'Volver al inicio de sesión'}
                >
                  <Text style={styles.cancelButtonText}>
                    {isSignupMode ? 'VOLVER AL REGISTRO' : 'VOLVER AL INICIO DE SESIÓN'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.goldRule} />
            <AndeanTocapuBand />
            <View style={styles.goldRule} />

            <View style={styles.ticketFooter}>
              <Text style={styles.folio}>
                {isSignupMode
                  ? 'EMPRESA DE TRANSPORTES CHASKI · EMISIÓN DE PASAJES'
                  : 'EMPRESA DE TRANSPORTES CHASKI · ASISTENCIA AL PASAJERO'}
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
  tocapuBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 5,
    backgroundColor: Colors.light.backgroundElement,
  },
  tocapuCell: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surface,
  },
  tocapuDiamond: {
    width: 6,
    height: 6,
    backgroundColor: Colors.light.primary,
    transform: [{ rotate: '45deg' }],
  },
  tocapuDiamondGold: {
    width: 6,
    height: 6,
    backgroundColor: Colors.light.accent,
    transform: [{ rotate: '45deg' }],
  },
  tocapuSquareInSquare: {
    width: 6,
    height: 6,
    backgroundColor: Colors.light.brand,
  },
  tocapuSteppedCross: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: 'transparent',
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
  emailHighlight: {
    fontWeight: '700',
    color: Colors.light.brand,
  },
  form: {
    gap: 14,
  },
  inputLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  otpInput: {
    height: 60,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 28,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    color: Colors.light.brand,
    backgroundColor: Colors.light.backgroundElement,
    textAlign: 'center',
    letterSpacing: 10,
  },
  errorBox: {
    backgroundColor: '#FDF2F2',
    borderWidth: 1,
    borderColor: Colors.light.error,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    color: Colors.light.error,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  feedbackBox: {
    backgroundColor: '#F0F9EB',
    borderWidth: 1,
    borderColor: Colors.light.success,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  feedbackText: {
    color: Colors.light.success,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  primaryButton: {
    height: 50,
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '700',
    color: Colors.light.surface,
  },
  resendSection: {
    marginTop: 8,
    alignItems: 'center',
  },
  cooldownText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  cooldownSeconds: {
    fontFamily: Fonts.mono,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  resendButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resendButtonText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  resendButtonStrong: {
    color: Colors.light.primary,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  ticketFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  folio: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.light.textSecondary,
  },
});
