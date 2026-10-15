/**
 * `useOtpVerification` — coordinación de la verificación y el reenvío de códigos OTP.
 *
 * Extraído de la pantalla de verificación (flujos signup y recovery):
 * - `runOtpVerification` / `runOtpResend`: orquestación pura con dependencias
 *   inyectables (servicios + banderas del contexto de sesión), en el mismo orden
 *   de operaciones, estados y mensajes que el histórico.
 * - El hook encapsula los estados de la UI (código, loading, resending, error,
 *   feedback) y compone `useOtpCooldown`. La navegación permanece en la pantalla.
 *
 * Idempotencia: el guard de "busy" evita ejecuciones concurrentes; la pantalla
 * decide la navegación según el resultado devuelto.
 */
import { useCallback, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  requestPasswordReset,
  resendSignupOtp,
  verifyRecoveryOtp,
  verifySignupOtp,
} from '../services/auth.service';
import { sanitizeOtpInput, validateOtpFormat } from '../utils/otp-validation';
import { useOtpCooldown } from './use-otp-cooldown';

export type OtpMode = 'signup' | 'recovery';
export type OtpPhase = 'verify' | 'resend';

/** Clasificación del fallo; el mensaje visible se resuelve con `otpErrorMessage`. */
export type OtpErrorKind = 'missing-email' | 'invalid-format' | 'server';

export type OtpFailureOutcome = {
  status: 'error';
  phase: OtpPhase;
  kind: OtpErrorKind;
  /** Detalle dinámico (validación o mensaje del servidor); null si no aplica. */
  detail: string | null;
};

export type OtpVerifyOutcome = { status: 'success' } | { status: 'ignored' } | OtpFailureOutcome;
export type OtpResendOutcome = { status: 'resent' } | { status: 'ignored' } | OtpFailureOutcome;

/** Respuesta mínima que el hook necesita de los servicios OTP. */
export type OtpServiceResult = {
  data: { session?: Session | null } | null;
  error: { message: string } | null;
};

const OTP_MISSING_EMAIL_VERIFY =
  'No se identificó el correo electrónico. Por favor, solicita el código nuevamente.';
const OTP_MISSING_EMAIL_RESEND = 'No se identificó el correo electrónico para reenviar el código.';
const OTP_INVALID_FORMAT_FALLBACK = 'Ingresa un código de 6 dígitos válido';

/** Copy de éxito del reenvío, por modo (textos históricos 1:1). */
export const OTP_FEEDBACK_MESSAGES: Record<OtpMode, string> = {
  signup: 'Se ha reenviado el código de confirmación a tu correo.',
  recovery: 'Se ha enviado un nuevo código de 6 dígitos a tu correo.',
};

/** Resuelve el mensaje visible de un fallo OTP (copy histórico 1:1). */
export function otpErrorMessage(outcome: OtpFailureOutcome): string {
  if (outcome.kind === 'missing-email') {
    return outcome.phase === 'resend' ? OTP_MISSING_EMAIL_RESEND : OTP_MISSING_EMAIL_VERIFY;
  }
  if (outcome.kind === 'invalid-format') {
    return outcome.detail ?? OTP_INVALID_FORMAT_FALLBACK;
  }
  // 'server': el detalle es el mensaje (sanitizado) devuelto por el servicio.
  return outcome.detail ?? '';
}

/**
 * Orquesta la verificación de un código OTP.
 *
 * Orden (idéntico al histórico):
 * 1. Guardas de concurrencia y validación de entrada (sin llamar a servicios).
 * 2. `onStarting` (activar loading y limpiar mensajes).
 * 3. Recovery: pre-activa la bandera de recuperación ANTES de llamar a Supabase.
 * 4. Verificación contra Supabase Auth y banderas de resultado.
 * 5. Signup: sincroniza preferencias antes de que la pantalla navegue.
 */
export async function runOtpVerification(options: {
  email: string;
  mode: OtpMode;
  code: string;
  busy: boolean;
  /** Tras validar la entrada y antes de llamar a Supabase. */
  onStarting?: () => void;
  setIsPasswordRecovery: (isRecovery: boolean) => void;
  setIsRecoveryVerified: (isVerified: boolean) => void;
  setSession: (session: Session | null) => void;
  checkPreferences: () => Promise<void>;
  verifySignupOtp: (email: string, code: string) => Promise<OtpServiceResult>;
  verifyRecoveryOtp: (email: string, code: string) => Promise<OtpServiceResult>;
}): Promise<OtpVerifyOutcome> {
  const { email, mode, code, busy, onStarting } = options;

  if (busy) return { status: 'ignored' };

  if (!email) {
    return { status: 'error', phase: 'verify', kind: 'missing-email', detail: null };
  }

  const validation = validateOtpFormat(code);
  if (!validation.isValid) {
    return {
      status: 'error',
      phase: 'verify',
      kind: 'invalid-format',
      detail: validation.error ?? null,
    };
  }

  onStarting?.();

  if (mode === 'recovery') {
    // Pre-activar la bandera de recuperación para blindar RootNavigator ante eventos SIGNED_IN
    options.setIsPasswordRecovery(true);
    const { data, error } = await options.verifyRecoveryOtp(email, code);

    if (error) {
      options.setIsPasswordRecovery(false);
      options.setIsRecoveryVerified(false);
      return { status: 'error', phase: 'verify', kind: 'server', detail: error.message ?? null };
    }

    // Éxito en recuperación: banderas activas (la pantalla navega a reset-password)
    options.setIsPasswordRecovery(true);
    options.setIsRecoveryVerified(true);
    if (data?.session) options.setSession(data.session);
    return { status: 'success' };
  }

  // Flujo de Registro OTP
  const { data, error } = await options.verifySignupOtp(email, code);

  if (error) {
    // En registro, un fallo NO toca las banderas de recuperación
    return { status: 'error', phase: 'verify', kind: 'server', detail: error.message ?? null };
  }

  // En registro, NO activar banderas de recuperación
  options.setIsPasswordRecovery(false);
  options.setIsRecoveryVerified(false);
  if (data?.session) options.setSession(data.session);

  // Sincronizar preferencias antes de navegar para evitar estados intermedios en RootNavigator
  await options.checkPreferences();
  return { status: 'success' };
}

/**
 * Orquesta el reenvío del código OTP. `busy` incluye loading, reenvío en curso
 * y cooldown activo (las mismas guardas del histórico).
 */
export async function runOtpResend(options: {
  email: string;
  mode: OtpMode;
  busy: boolean;
  /** Tras validar la entrada y antes de llamar a Supabase. */
  onStarting?: () => void;
  resendSignupOtp: (email: string) => Promise<{ error: { message: string } | null }>;
  requestPasswordReset: (
    email: string,
    options: { redirectTo: null },
  ) => Promise<{ error: { message: string } | null }>;
}): Promise<OtpResendOutcome> {
  const { email, mode, busy, onStarting } = options;

  if (busy) return { status: 'ignored' };

  if (!email) {
    return { status: 'error', phase: 'resend', kind: 'missing-email', detail: null };
  }

  onStarting?.();

  const { error } =
    mode === 'signup'
      ? await options.resendSignupOtp(email)
      : await options.requestPasswordReset(email, { redirectTo: null });

  if (error) {
    return { status: 'error', phase: 'resend', kind: 'server', detail: error.message ?? null };
  }

  return { status: 'resent' };
}

export type UseOtpVerificationResult = {
  /** Código actual (solo dígitos, máximo 6). */
  code: string;
  /** Entrada del campo OTP: sanitiza y limpia el error visible. */
  changeCode: (raw: string) => void;
  loading: boolean;
  resending: boolean;
  error: string;
  feedback: string;
  cooldown: number;
  /**
   * Verifica el código. La pantalla navega solo cuando devuelve `{ status: 'success' }`
   * (misma semántica que el handler histórico).
   */
  verify: () => Promise<OtpVerifyOutcome>;
  /** Reenvía el código: gestiona loading, feedback y cooldown. */
  resend: () => Promise<OtpResendOutcome>;
};

/**
 * Hook de la pantalla de verificación OTP: estados de UI + coordinación.
 * La navegación y el JSX permanecen en la pantalla.
 */
export function useOtpVerification(options: {
  email: string;
  mode: OtpMode;
  setIsPasswordRecovery: (isRecovery: boolean) => void;
  setIsRecoveryVerified: (isVerified: boolean) => void;
  setSession: (session: Session | null) => void;
  checkPreferences: () => Promise<void>;
}): UseOtpVerificationResult {
  const {
    email,
    mode,
    setIsPasswordRecovery,
    setIsRecoveryVerified,
    setSession,
    checkPreferences,
  } = options;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const { cooldown, restart } = useOtpCooldown();

  const changeCode = useCallback((raw: string) => {
    setCode(sanitizeOtpInput(raw));
    setError((prev) => (prev ? '' : prev));
  }, []);

  const verify = useCallback(async (): Promise<OtpVerifyOutcome> => {
    const outcome = await runOtpVerification({
      email,
      mode,
      code,
      busy: loading || resending,
      onStarting: () => {
        setLoading(true);
        setError('');
        setFeedback('');
      },
      setIsPasswordRecovery,
      setIsRecoveryVerified,
      setSession,
      checkPreferences,
      verifySignupOtp: (mail, otp) => verifySignupOtp(mail, otp),
      verifyRecoveryOtp: (mail, otp) => verifyRecoveryOtp(mail, otp),
    });

    if (outcome.status === 'ignored') return outcome;

    if (outcome.status === 'error') {
      setError(otpErrorMessage(outcome));
      setLoading(false);
      return outcome;
    }

    setLoading(false);
    return outcome;
  }, [email, mode, code, loading, resending, setIsPasswordRecovery, setIsRecoveryVerified, setSession, checkPreferences]);

  const resend = useCallback(async (): Promise<OtpResendOutcome> => {
    const outcome = await runOtpResend({
      email,
      mode,
      busy: loading || resending || cooldown > 0,
      onStarting: () => {
        setResending(true);
        setError('');
        setFeedback('');
      },
      resendSignupOtp: (mail) => resendSignupOtp(mail),
      requestPasswordReset: (mail, opts) => requestPasswordReset(mail, opts),
    });

    if (outcome.status === 'ignored') return outcome;

    if (outcome.status === 'error') {
      setError(otpErrorMessage(outcome));
    } else {
      setFeedback(OTP_FEEDBACK_MESSAGES[mode]);
      restart();
    }

    setResending(false);
    return outcome;
  }, [email, mode, loading, resending, cooldown, restart]);

  return {
    code,
    changeCode,
    loading,
    resending,
    error,
    feedback,
    cooldown,
    verify,
    resend,
  };
}
