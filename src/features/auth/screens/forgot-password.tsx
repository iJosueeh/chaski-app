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

/**
 * Pantalla pública para solicitar recuperación de contraseña por correo.
 * Sigue la identidad visual de boleto Serie AX.
 * Utiliza una confirmación neutral para evitar la enumeración de correos.
 */
export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading || success) return;

    const validation = validateEmail(email);
    if (!validation.isValid) {
      setError(validation.error ?? 'Correo inválido');
      return;
    }

    setLoading(true);
    setError('');

    const { error: resetError } = await requestPasswordReset(email.trim());

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
      // Confirmación neutral: no revela si el correo existe o no en la base de datos
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
                Ingresa tu correo electrónico para enviarte las instrucciones de restablecimiento.
              </Text>

              {success ? (
                <View style={styles.successBox}>
                  <Text style={styles.successIcon}>✉</Text>
                  <Text style={styles.successTitle}>Solicitud Enviada</Text>
                  <Text style={styles.successText}>
                    Si el correo ingresado se encuentra registrado en Chaski, recibirás un mensaje
                    con el enlace de restablecimiento. Por favor, revisa también tu carpeta de correo no deseado.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => router.replace('/login')}
                  >
                    <Text style={styles.primaryButtonText}>VOLVER AL INICIO DE SESIÓN</Text>
                  </TouchableOpacity>
                </View>
              ) : (
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
