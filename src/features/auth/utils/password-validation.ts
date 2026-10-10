/**
 * Validaciones para el cambio y actualización de contraseña en Chaski.
 *
 * Aplica los requisitos reales configurados en Supabase Auth:
 *  - Longitud mínima de 6 caracteres (estándar de Supabase).
 *  - Coincidencia exacta entre nueva contraseña y confirmación.
 *  - Rechazo de campos vacíos o sólo espacios en blanco.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

export function validatePasswordChange(
  newPassword: string,
  confirmPassword: string,
): PasswordValidationResult {
  if (!newPassword || newPassword.trim().length === 0) {
    return { isValid: false, error: 'Ingresa la nueva contraseña' };
  }

  if (newPassword.length < 6) {
    return {
      isValid: false,
      error: 'La contraseña debe tener al menos 6 caracteres',
    };
  }

  if (!confirmPassword || confirmPassword.trim().length === 0) {
    return { isValid: false, error: 'Confirma la nueva contraseña' };
  }

  if (newPassword !== confirmPassword) {
    return { isValid: false, error: 'Las contraseñas no coinciden' };
  }

  return { isValid: true };
}

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateEmail(email: string): EmailValidationResult {
  if (!email || email.trim().length === 0) {
    return { isValid: false, error: 'Ingresa tu correo electrónico' };
  }

  // Validación estándar de formato de correo electrónico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Ingresa un formato de correo válido' };
  }

  return { isValid: true };
}
