export interface OtpValidationResult {
  isValid: boolean;
  error?: string;
}

export function normalizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

export function validateOtpFormat(token: string | null | undefined): OtpValidationResult {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return {
      isValid: false,
      error: 'Ingresa el código de verificación',
    };
  }

  const cleaned = token.trim();

  if (!/^\d{6}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'El código de verificación debe contener 6 dígitos numéricos',
    };
  }

  return { isValid: true };
}

export function sanitizeOtpInput(value: string): string {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\D/g, '').slice(0, 6);
}

export function sanitizeAuthError(error: any): { message: string } {
  if (!error) {
    return { message: 'Ha ocurrido un error inesperado al procesar la solicitud.' };
  }

  const rawMessage = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const status = typeof error.status === 'number' ? error.status : null;

  if (
    status === 429 ||
    rawMessage.includes('rate limit') ||
    rawMessage.includes('too many') ||
    rawMessage.includes('over_email_send_rate_limit') ||
    rawMessage.includes('for security purposes')
  ) {
    return {
      message: 'Has superado el límite de intentos. Por favor, espera unos minutos antes de intentar de nuevo.',
    };
  }

  if (
    rawMessage.includes('token has expired or is invalid') ||
    rawMessage.includes('token is invalid or has expired') ||
    rawMessage.includes('invalid') ||
    rawMessage.includes('not found') ||
    rawMessage.includes('incorrect')
  ) {
    return {
      message: 'El código de verificación es incorrecto o ya ha sido utilizado.',
    };
  }

  if (rawMessage.includes('expired')) {
    return {
      message: 'El código de verificación ha expirado. Por favor, solicita uno nuevo.',
    };
  }

  if (status === 400 || status === 401) {
    return {
      message: 'El código de verificación es incorrecto o ya ha sido utilizado.',
    };
  }

  return {
    message: 'No se pudo verificar el código de verificación. Verifica el código e intenta nuevamente.',
  };
}
