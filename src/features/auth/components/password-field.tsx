import { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Colors, Fonts } from '@/constants/theme';

export interface PasswordFieldProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label: string;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
  toggleAccessibilityLabel: string;
  toggleAccessibilityHint: string;
}

/**
 * Campo de contraseña reutilizable con alternancia de visibilidad accesible (Serie AX).
 * Utiliza SymbolView para iconos consistentes en iOS, Android y Web.
 */
export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(
  (
    {
      label,
      showPassword,
      onToggleShowPassword,
      accessibilityLabel,
      accessibilityHint,
      toggleAccessibilityLabel,
      toggleAccessibilityHint,
      style,
      placeholder = 'Mínimo 6 caracteres',
      editable = true,
      ...textInputProps
    },
    ref,
  ) => {
    return (
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.passwordFieldContainer}>
          <TextInput
            ref={ref}
            style={[styles.passwordInput, style]}
            placeholder={placeholder}
            placeholderTextColor={Colors.light.textSecondary}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={editable}
            accessible={true}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            {...textInputProps}
          />
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={onToggleShowPassword}
            accessibilityRole="button"
            accessibilityLabel={toggleAccessibilityLabel}
            accessibilityHint={toggleAccessibilityHint}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            disabled={!editable}
          >
            <SymbolView
              name={
                showPassword
                  ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
                  : { ios: 'eye', android: 'visibility', web: 'visibility' }
              }
              size={20}
              tintColor={Colors.light.textSecondary}
              fallback={
                <Text style={styles.passwordFallbackText}>
                  {showPassword ? 'OCULTAR' : 'VER'}
                </Text>
              }
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);

PasswordField.displayName = 'PasswordField';

const styles = StyleSheet.create({
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
  passwordFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    backgroundColor: Colors.light.backgroundElement,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: Fonts.sans,
    color: Colors.light.text,
  },
  passwordToggle: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  passwordFallbackText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
});
