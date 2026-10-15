import { normalizeEmail } from "./otp-validation";

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

export function validatePasswordChange(
  newPassword: string,
  confirmPassword: string,
): PasswordValidationResult {
  if (!newPassword || newPassword.trim().length === 0) {
    return { isValid: false, error: "Ingresa la nueva contraseña" };
  }

  if (newPassword.length < 6) {
    return {
      isValid: false,
      error: "La contraseña debe tener al menos 6 caracteres",
    };
  }

  if (!confirmPassword || confirmPassword.trim().length === 0) {
    return { isValid: false, error: "Confirma la nueva contraseña" };
  }

  if (newPassword !== confirmPassword) {
    return { isValid: false, error: "Las contraseñas no coinciden" };
  }

  return { isValid: true };
}

export function validateRegistrationPassword(
  password: string,
  confirmPassword: string,
): PasswordValidationResult {
  if (!password || password.trim().length === 0) {
    return { isValid: false, error: "Ingresa una contraseña" };
  }

  if (password.length < 6) {
    return {
      isValid: false,
      error: "La contraseña debe tener al menos 6 caracteres",
    };
  }

  if (!confirmPassword || confirmPassword.trim().length === 0) {
    return { isValid: false, error: "Confirma tu contraseña" };
  }

  if (password !== confirmPassword) {
    return { isValid: false, error: "Las contraseñas no coinciden" };
  }

  return { isValid: true };
}

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateEmail(email: string): EmailValidationResult {
  if (!email || email.trim().length === 0) {
    return { isValid: false, error: "Ingresa tu correo electrónico" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: "Ingresa un formato de correo válido" };
  }

  return { isValid: true };
}

export interface LoginValidationResult {
  isValid: boolean;
  emailError?: string;
  passwordError?: string;
  normalizedEmail?: string;
}

export function validateLoginFields(email: string, password: string): LoginValidationResult {
  const normalizedEmail = normalizeEmail(email);

  const emailValidation = validateEmail(normalizedEmail);
  const emailError = emailValidation.isValid ? undefined : emailValidation.error;
  const passwordError = password ? undefined : "Ingresa tu contraseña";

  if (emailError || passwordError) {
    return { isValid: false, emailError, passwordError };
  }

  return { isValid: true, normalizedEmail };
}

export interface NameValidationResult {
  isValid: boolean;
  error?: string;
  trimmedName?: string;
}

export function validateFullName(name: string): NameValidationResult {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: "Ingresa tu nombre completo" };
  }

  return { isValid: true, trimmedName: name.trim() };
}
