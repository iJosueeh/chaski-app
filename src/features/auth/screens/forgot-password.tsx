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
import { requestPasswordReset } from '@/features/auth/services/auth.service';
import { validateEmail } from '@/features/auth/utils/password-validation';

import { normalizeEmail } from '@/features/auth/utils/otp-validation';

/**
 * Pantalla pública para solicitar recuperación de contraseña por correo.
 * Sigue la identidad visual de boleto Serie AX.
 * Solicita el código OTP de 6 dígitos y redirige a la pantalla de verificación.
 */
export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;

    const normalized = normalizeEmail(email);
    const validation = validateEmail(normalized);
    if (!validation.isValid) {
      setError(validation.error ?? 'Correo inválido');
      return;
    }

    setLoading(true);
    setError('');

    const { error: resetError } = await requestPasswordReset(normalized, { redirectTo: null });

    if (resetError) {
      if (
        resetError.message.toLowerCase().includes('rate limit') ||
        resetError.message.toLowerCase().includes('too many requests')
      ) {
        setError(
          'Has realizado demasiadas solicitudes recientemente. Espera unos minutos antes de intentar de nuevo.',
        );
      } else {
        setError(resetError.message);
      }
      setLoading(false);
    } else {
      setLoading(false);
      // Navegación inmediata a verify-otp pasando el correo normalizado sin secretos
      router.push({
        pathname: '/verify-otp',
        params: { email: normalized },
      });
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
          <View style={styles.ticket}>
            {/* Encabezado del boleto */}
            <View style={styles.ticketHeader}>
              <Text style={styles.brand}>CHASKI</Text>
              <Text style={styles.serie}>RECUPERACIÓN DE ACCESO · SERIE AX</Text>
            </View>

            <View style={styles.goldRule} />

            <View style={styles.ticketBody}>
              <Text style={styles.title}>Recuperar Contraseña</Text>
              <Text style={styles.subtitle}>
                Ingresa tu correo electrónico para enviarte un código de recuperación de 6 dígitos.
              </Text>

              <View style={styles.form}>
                <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ejemplo@correo.com"
                    placeholderTextColor={Colors.light.textSecondary}
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (error) setError('');
                    }}
                    keyboardType="email-address"
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
                      <Text style={styles.primaryButtonText}>ENVIAR INSTRUCCIONES</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => router.back()}
                    disabled={loading}
                  >
                    <Text style={styles.cancelButtonText}>VOLVER AL INICIO DE SESIÓN</Text>
                  </TouchableOpacity>
                </View>
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
