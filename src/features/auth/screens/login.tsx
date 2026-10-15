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
import { AndeanTransitStamp } from '@/features/auth/components/andean-transit-stamp';
import { AuthTicketLayout } from '@/features/auth/components/auth-ticket-layout';
import { PasswordField } from '@/features/auth/components/password-field';
import { useAuth } from '@/features/auth/context/auth-context';
import { useLogin } from '@/features/auth/hooks';

export function LoginScreen() {
  const { setIsPasswordRecovery, setIsRecoveryVerified } = useAuth();
  const {
    email,
    password,
    showPassword,
    loading,
    error,
    emailError,
    passwordError,
    changeEmail,
    changePassword,
    toggleShowPassword,
    submit,
  } = useLogin({ setIsPasswordRecovery, setIsRecoveryVerified });
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isCompactHeight = height < 720;

  const currentFocusedFieldRef = useRef<string | null>(null);
  const fieldYOffsets = useRef<Record<string, number>>({});

  const showDecoration = !keyboardVisible && !isCompactHeight && !isLandscape;

  const getTargetScrollOffset = useCallback(
    (fieldKey: string): number => {
      if (typeof fieldYOffsets.current[fieldKey] === 'number') {
        return fieldYOffsets.current[fieldKey];
      }
      const defaults = isCompactHeight
        ? { email: 0, password: 80 }
        : { email: 0, password: 100 };
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
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener?.(showEvent, () => {
      setKeyboardVisible(true);
      if (currentFocusedFieldRef.current) {
        scrollToActiveField(currentFocusedFieldRef.current, true);
      }
    });

    const hideSub = Keyboard.addListener?.(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub?.remove?.();
      hideSub?.remove?.();
    };
  }, [scrollToActiveField]);

  const handleLogin = async () => {
    const targetField = await submit();
    if (targetField) {
      scrollToActiveField(targetField);
    }
  };

  return (
    <AuthTicketLayout
      serie="SERIE AX · NRO 00001"
      title="Bienvenido"
      subtitle="Inicia sesión para planificar tu salida."
      footerFolio="EMPRESA DE TRANSPORTES CHASKI · LÍNEA CULTURAL"
      scrollViewRef={scrollViewRef}
      bottomDecorativeContent={showDecoration ? <AndeanTransitStamp /> : null}
    >
      <View style={styles.form}>
        {/* 1. Campo: Correo Electrónico */}
        <View style={styles.inputGroup} onLayout={handleFieldLayout('email')}>
          <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>
          <TextInput
            ref={emailInputRef}
            style={styles.input}
            placeholder="ejemplo@correo.com"
            placeholderTextColor={Colors.light.textSecondary}
            value={email}
            onChangeText={changeEmail}
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
            accessibilityHint="Ingresa tu correo registrado"
          />
          {emailError ? (
            <Text
              style={styles.fieldErrorText}
              accessible={true}
              accessibilityLiveRegion="polite"
            >
              {emailError}
            </Text>
          ) : null}
        </View>

        {/* 2. Campo: Contraseña (con visibilidad accesible) */}
        <View onLayout={handleFieldLayout('password')}>
          <PasswordField
            ref={passwordInputRef}
            label="CONTRASEÑA"
            placeholder="Tu contraseña"
            value={password}
            onChangeText={changePassword}
            onFocus={() => handleFocusField('password')}
            showPassword={showPassword}
            onToggleShowPassword={toggleShowPassword}
            accessibilityLabel="Contraseña"
            accessibilityHint="Ingresa tu contraseña"
            toggleAccessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            toggleAccessibilityHint="Alterna la visibilidad de los caracteres de la contraseña"
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={handleLogin}
            editable={!loading}
          />
          {passwordError ? (
            <Text
              style={styles.fieldErrorText}
              accessible={true}
              accessibilityLiveRegion="polite"
            >
              {passwordError}
            </Text>
          ) : null}
        </View>

        {/* Enlace de recuperación de contraseña */}
        <TouchableOpacity
          onPress={() => router.push('/forgot-password')}
          style={styles.forgotLink}
          accessibilityRole="link"
          accessibilityLabel="¿Olvidaste tu contraseña?"
          accessibilityHint="Navega a la pantalla para restablecer tu contraseña"
          disabled={loading}
        >
          <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

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
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Iniciar sesión"
          accessibilityState={{ disabled: loading, busy: loading }}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.light.surface} />
          ) : (
            <Text style={styles.primaryButtonText}>INICIAR SESIÓN</Text>
          )}
        </TouchableOpacity>

        {/* Enlace hacia Registro */}
        <TouchableOpacity
          onPress={() => router.push('/register')}
          style={styles.link}
          accessibilityRole="link"
          accessibilityLabel="¿No tienes boleto? Regístrate"
          accessibilityHint="Navega al formulario para emitir un nuevo boleto de pasajero"
          disabled={loading}
        >
          <Text style={styles.linkText}>
            ¿No tienes boleto? <Text style={styles.linkStrong}>Regístrate</Text>
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
  fieldErrorText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.light.error,
    marginTop: 2,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 4,
  },
  forgotText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '600',
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
