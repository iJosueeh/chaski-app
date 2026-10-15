import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { router } from 'expo-router';

import { Colors, Fonts } from '@/constants/theme';
import { AuthTicketLayout } from '@/features/auth/components/auth-ticket-layout';
import { PasswordField } from '@/features/auth/components/password-field';
import { signUp } from '@/features/auth/services/auth.service';
import { normalizeEmail } from '@/features/auth/utils/otp-validation';
import {
  validateEmail,
  validateFullName,
  validateRegistrationPassword,
} from '@/features/auth/utils/password-validation';

export function RegisterScreen() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const nombreInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const currentFocusedFieldRef = useRef<string | null>(null);
  const fieldYOffsets = useRef<Record<string, number>>({});
  const { height } = useWindowDimensions();
  const isCompactHeight = height < 680;

  const getTargetScrollOffset = useCallback(
    (fieldKey: string): number => {
      if (typeof fieldYOffsets.current[fieldKey] === 'number') {
        return fieldYOffsets.current[fieldKey];
      }
      const defaults = isCompactHeight
        ? { nombre: 0, email: 60, password: 130, confirmPassword: 210 }
        : { nombre: 0, email: 70, password: 150, confirmPassword: 230 };
      return defaults[fieldKey as keyof typeof defaults] ?? 0;
    },
    [isCompactHeight],
  );

  const scrollToActiveField = useCallback(
    (fieldKey: string, animated = true) => {
      const targetY = getTargetScrollOffset(fieldKey);
      scrollViewRef.current?.scrollTo({ y: targetY, animated });
    },
    [getTargetScrollOffset],
  );

  const handleFocusField = useCallback(
    (fieldKey: string) => {
      currentFocusedFieldRef.current = fieldKey;
      scrollToActiveField(fieldKey, true);
      setTimeout(() => {
        if (currentFocusedFieldRef.current === fieldKey) {
          scrollToActiveField(fieldKey, true);
        }
      }, 160);
    },
    [scrollToActiveField],
  );

  const handleFieldLayout = useCallback(
    (fieldKey: string) => (event: LayoutChangeEvent) => {
      fieldYOffsets.current[fieldKey] = event.nativeEvent.layout.y;
    },
    [],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener?.(showEvent, () => {
      if (currentFocusedFieldRef.current) {
        scrollToActiveField(currentFocusedFieldRef.current, true);
      }
    });

    return () => {
      sub?.remove?.();
    };
  }, [scrollToActiveField]);

  const handleRegister = async () => {
    if (loading) return;

    const trimmedNombre = nombre.trim();
    const normalizedEmail = normalizeEmail(email);

    const nameValidation = validateFullName(trimmedNombre);
    if (!nameValidation.isValid) {
      setError(nameValidation.error ?? 'Ingresa tu nombre completo');
      scrollToActiveField('nombre');
      return;
    }

    const emailValidation = validateEmail(normalizedEmail);
    if (!emailValidation.isValid) {
      setError(emailValidation.error ?? 'Ingresa un correo electrónico válido');
      scrollToActiveField('email');
      return;
    }

    const passwordValidation = validateRegistrationPassword(password, confirmPassword);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error ?? 'Verifica tu contraseña');
      scrollToActiveField('confirmPassword');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: authError } = await signUp({
        nombre: trimmedNombre,
        email: normalizedEmail,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        scrollToActiveField('confirmPassword');
      } else {
        setLoading(false);
        router.push({
          pathname: '/verify-otp',
          params: {
            email: normalizedEmail,
            mode: 'signup',
          },
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Ocurrió un error inesperado al emitir el boleto');
      setLoading(false);
      scrollToActiveField('confirmPassword');
    }
  };

  return (
    <AuthTicketLayout
      serie="EMISIÓN DE BOLETO · SERIE AX"
      title="Nuevo Pasajero"
      subtitle="Ingresa tus datos para emitir tu boleto de viaje y comenzar tu ruta."
      footerFolio="EMPRESA DE TRANSPORTES CHASKI · LÍNEA CULTURAL"
      scrollViewRef={scrollViewRef}
    >
      <View style={styles.form}>
        {/* 1. Campo: Nombre Completo */}
        <View style={styles.inputGroup} onLayout={handleFieldLayout('nombre')}>
          <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
          <TextInput
            ref={nombreInputRef}
            style={styles.input}
            placeholder="Ej. Tupac Yupanqui"
            placeholderTextColor={Colors.light.textSecondary}
            value={nombre}
            onChangeText={(val) => {
              setNombre(val);
              if (error) setError('');
            }}
            onFocus={() => handleFocusField('nombre')}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => emailInputRef.current?.focus()}
            blurOnSubmit={false}
            editable={!loading}
            accessible={true}
            accessibilityLabel="Nombre completo"
            accessibilityHint="Ingresa tu nombre y apellido para el boleto"
          />
        </View>

        {/* 2. Campo: Correo Electrónico */}
        <View style={styles.inputGroup} onLayout={handleFieldLayout('email')}>
          <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>
          <TextInput
            ref={emailInputRef}
            style={styles.input}
            placeholder="ejemplo@correo.com"
            placeholderTextColor={Colors.light.textSecondary}
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              if (error) setError('');
            }}
            onFocus={() => handleFocusField('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            blurOnSubmit={false}
            editable={!loading}
            accessible={true}
            accessibilityLabel="Correo electrónico"
            accessibilityHint="Dirección de correo electrónico donde recibirás tu código de confirmación"
          />
        </View>

        {/* 3. Campo: Contraseña (visibilidad independiente) */}
        <View onLayout={handleFieldLayout('password')}>
          <PasswordField
            ref={passwordInputRef}
            label="CONTRASEÑA"
            value={password}
            onChangeText={(val) => {
              setPassword(val);
              if (error) setError('');
            }}
            onFocus={() => handleFocusField('password')}
            showPassword={showPassword}
            onToggleShowPassword={() => setShowPassword((prev) => !prev)}
            accessibilityLabel="Contraseña"
            accessibilityHint="Contraseña de al menos 6 caracteres"
            toggleAccessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            toggleAccessibilityHint="Alterna la visibilidad de los caracteres de la contraseña"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
            editable={!loading}
          />
        </View>

        {/* 4. Campo: Confirmar Contraseña (visibilidad independiente) */}
        <View onLayout={handleFieldLayout('confirmPassword')}>
          <PasswordField
            ref={confirmPasswordInputRef}
            label="CONFIRMAR CONTRASEÑA"
            placeholder="Repite la contraseña"
            value={confirmPassword}
            onChangeText={(val) => {
              setConfirmPassword(val);
              if (error) setError('');
            }}
            onFocus={() => handleFocusField('confirmPassword')}
            showPassword={showConfirmPassword}
            onToggleShowPassword={() => setShowConfirmPassword((prev) => !prev)}
            accessibilityLabel="Confirmar contraseña"
            accessibilityHint="Repite la contraseña para confirmar que coincidan"
            toggleAccessibilityLabel={
              showConfirmPassword
                ? 'Ocultar confirmación de contraseña'
                : 'Mostrar confirmación de contraseña'
            }
            toggleAccessibilityHint="Alterna la visibilidad de los caracteres de la confirmación de contraseña"
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={handleRegister}
            editable={!loading}
          />
        </View>

        {/* Mensaje de error accesible */}
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

        {/* Botón Principal */}
        <TouchableOpacity
          style={[styles.primaryButton, { opacity: loading ? 0.6 : 1 }]}
          onPress={handleRegister}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Crear cuenta y emitir boleto"
          accessibilityState={{ disabled: loading, busy: loading }}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.light.surface} />
          ) : (
            <Text style={styles.primaryButtonText}>EMITIR BOLETO</Text>
          )}
        </TouchableOpacity>

        {/* Enlace hacia Login */}
        <TouchableOpacity
          onPress={() => router.push('/login')}
          style={styles.link}
          accessibilityRole="link"
          accessibilityLabel="¿Ya tienes boleto? Inicia sesión"
          disabled={loading}
        >
          <Text style={styles.linkText}>
            ¿Ya tienes boleto? <Text style={styles.linkStrong}>Inicia sesión</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </AuthTicketLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.light.textSecondary,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: Fonts.sans,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundElement,
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
  link: {
    marginTop: 18,
    alignItems: 'center',
  },
  linkText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  linkStrong: {
    color: Colors.light.primary,
    fontWeight: '700',
  },
});
