import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';

import {
  otpErrorMessage,
  OTP_FEEDBACK_MESSAGES,
  runOtpResend,
  runOtpVerification,
} from '../hooks/use-otp-verification';
import { OTP_COOLDOWN_SECONDS, tickCooldown } from '../hooks/use-otp-cooldown';
import { sanitizeOtpInput } from '../utils/otp-validation';

vi.mock('expo-linking', () => ({
  createURL: vi.fn((path: string) => `chaski://${path.replace(/^\//, '')}`),
  useURL: vi.fn(() => null),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: {} },
}));

function makeSession(): Session {
  return { access_token: 'tok-1', token_type: 'bearer', user: { id: 'user-1' } } as unknown as Session;
}

function makeFlags() {
  return {
    setIsPasswordRecovery: vi.fn<(isRecovery: boolean) => void>(),
    setIsRecoveryVerified: vi.fn<(isVerified: boolean) => void>(),
    setSession: vi.fn<(session: Session | null) => void>(),
    checkPreferences: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

describe('use-otp-verification — runOtpVerification (orquestación real)', () => {
  it('éxito en signup: banderas desactivadas, sesión, preferencias y orden exacto', async () => {
    const log: string[] = [];

    const outcome = await runOtpVerification({
      email: 'viajero@chaski.pe',
      mode: 'signup',
      code: '123456',
      busy: false,
      onStarting: () => log.push('starting'),
      setIsPasswordRecovery: (v) => log.push(`recovery:${v}`),
      setIsRecoveryVerified: (v) => log.push(`verified:${v}`),
      setSession: (s) => log.push(`session:${s?.access_token ?? 'null'}`),
      checkPreferences: async () => {
        log.push('preferences');
      },
      verifySignupOtp: async () => {
        log.push('service');
        return { data: { session: makeSession() }, error: null };
      },
      verifyRecoveryOtp: async () => ({ data: null, error: null }),
    });

    expect(outcome).toEqual({ status: 'success' });
    expect(log).toEqual([
      'starting',
      'service',
      'recovery:false',
      'verified:false',
      'session:tok-1',
      'preferences',
    ]);
  });

  it('éxito en signup sin sesión: no llama a setSession pero sí sincroniza preferencias', async () => {
    const flags = makeFlags();

    const outcome = await runOtpVerification({
      email: 'viajero@chaski.pe',
      mode: 'signup',
      code: '123456',
      busy: false,
      ...flags,
      verifySignupOtp: async () => ({ data: { session: null }, error: null }),
      verifyRecoveryOtp: async () => ({ data: null, error: null }),
    });

    expect(outcome).toEqual({ status: 'success' });
    expect(flags.setSession).not.toHaveBeenCalled();
    expect(flags.checkPreferences).toHaveBeenCalledTimes(1);
    expect(flags.setIsPasswordRecovery).toHaveBeenCalledWith(false);
    expect(flags.setIsRecoveryVerified).toHaveBeenCalledWith(false);
  });

  it('fallo en signup: NO toca las banderas de recuperación ni sincroniza preferencias', async () => {
    const log: string[] = [];
    const flags = makeFlags();

    const outcome = await runOtpVerification({
      email: 'viajero@chaski.pe',
      mode: 'signup',
      code: '123456',
      busy: false,
      ...flags,
      setIsPasswordRecovery: (v) => log.push(`recovery:${v}`),
      setIsRecoveryVerified: (v) => log.push(`verified:${v}`),
      verifySignupOtp: async () => ({ data: null, error: { message: 'OTP inválido' } }),
      verifyRecoveryOtp: async () => ({ data: null, error: null }),
    });

    expect(outcome).toEqual({
      status: 'error',
      phase: 'verify',
      kind: 'server',
      detail: 'OTP inválido',
    });
    expect(log).toEqual([]);
    expect(flags.checkPreferences).not.toHaveBeenCalled();
    expect(flags.setSession).not.toHaveBeenCalled();
  });

  it('éxito en recovery: pre-activa la bandera ANTES del servicio y la confirma tras el éxito', async () => {
    const log: string[] = [];

    const outcome = await runOtpVerification({
      email: 'viajero@chaski.pe',
      mode: 'recovery',
      code: '123456',
      busy: false,
      onStarting: () => log.push('starting'),
      setIsPasswordRecovery: (v) => log.push(`recovery:${v}`),
      setIsRecoveryVerified: (v) => log.push(`verified:${v}`),
      setSession: (s) => log.push(`session:${s?.access_token ?? 'null'}`),
      checkPreferences: async () => {
        log.push('preferences');
      },
      verifySignupOtp: async () => ({ data: null, error: null }),
      verifyRecoveryOtp: async () => {
        log.push('service');
        return { data: { session: makeSession() }, error: null };
      },
    });

    expect(outcome).toEqual({ status: 'success' });
    expect(log).toEqual([
      'starting',
      'recovery:true',
      'service',
      'recovery:true',
      'verified:true',
      'session:tok-1',
    ]);
    // En recuperación no se sincronizan preferencias (semántica histórica)
    expect(log).not.toContain('preferences');
  });

  it('fallo en recovery: desactiva ambas banderas y devuelve el detalle del servidor', async () => {
    const log: string[] = [];

    const outcome = await runOtpVerification({
      email: 'viajero@chaski.pe',
      mode: 'recovery',
      code: '123456',
      busy: false,
      setIsPasswordRecovery: (v) => log.push(`recovery:${v}`),
      setIsRecoveryVerified: (v) => log.push(`verified:${v}`),
      setSession: vi.fn(),
      checkPreferences: vi.fn(),
      verifySignupOtp: async () => ({ data: null, error: null }),
      verifyRecoveryOtp: async () => ({ data: null, error: { message: 'Código incorrecto' } }),
    });

    expect(outcome).toEqual({
      status: 'error',
      phase: 'verify',
      kind: 'server',
      detail: 'Código incorrecto',
    });
    expect(log).toEqual(['recovery:true', 'recovery:false', 'verified:false']);
  });

  it('sin correo: fallo de validación sin llamar a servicios ni activar loading', async () => {
    const onStarting = vi.fn(() => {});
    const verifySignupOtp = vi.fn(async () => ({ data: null, error: null }));
    const verifyRecoveryOtp = vi.fn(async () => ({ data: null, error: null }));

    const outcome = await runOtpVerification({
      email: '',
      mode: 'signup',
      code: '123456',
      busy: false,
      onStarting,
      ...makeFlags(),
      verifySignupOtp,
      verifyRecoveryOtp,
    });

    expect(outcome).toEqual({
      status: 'error',
      phase: 'verify',
      kind: 'missing-email',
      detail: null,
    });
    expect(onStarting).not.toHaveBeenCalled();
    expect(verifySignupOtp).not.toHaveBeenCalled();
    expect(verifyRecoveryOtp).not.toHaveBeenCalled();
  });

  it('código inválido: devuelve el mensaje real de validación', async () => {
    const onStarting = vi.fn(() => {});
    const verifySignupOtp = vi.fn(async () => ({ data: null, error: null }));

    const outcome = await runOtpVerification({
      email: 'viajero@chaski.pe',
      mode: 'recovery',
      code: '12ab',
      busy: false,
      onStarting,
      ...makeFlags(),
      verifySignupOtp,
      verifyRecoveryOtp: vi.fn(),
    });

    expect(outcome).toEqual({
      status: 'error',
      phase: 'verify',
      kind: 'invalid-format',
      detail: 'El código de verificación debe contener 6 dígitos numéricos',
    });
    expect(onStarting).not.toHaveBeenCalled();
    expect(verifySignupOtp).not.toHaveBeenCalled();
  });

  it('ejecución concurrente: la segunda llamada se ignora sin tocar estados', async () => {
    const onStarting = vi.fn(() => {});
    const verifySignupOtp = vi.fn(async () => ({ data: null, error: null }));

    const outcome = await runOtpVerification({
      email: 'viajero@chaski.pe',
      mode: 'signup',
      code: '123456',
      busy: true,
      onStarting,
      ...makeFlags(),
      verifySignupOtp,
      verifyRecoveryOtp: vi.fn(),
    });

    expect(outcome).toEqual({ status: 'ignored' });
    expect(onStarting).not.toHaveBeenCalled();
    expect(verifySignupOtp).not.toHaveBeenCalled();
  });
});

describe('use-otp-verification — runOtpResend (reenvío real)', () => {
  it('reenvío de signup: usa resendSignupOtp y devuelve «resent»', async () => {
    const onStarting = vi.fn();
    const resendSignupOtp = vi.fn().mockResolvedValue({ error: null });
    const requestPasswordReset = vi.fn();

    const outcome = await runOtpResend({
      email: 'viajero@chaski.pe',
      mode: 'signup',
      busy: false,
      onStarting,
      resendSignupOtp,
      requestPasswordReset,
    });

    expect(outcome).toEqual({ status: 'resent' });
    expect(onStarting).toHaveBeenCalledTimes(1);
    expect(resendSignupOtp).toHaveBeenCalledTimes(1);
    expect(resendSignupOtp).toHaveBeenCalledWith('viajero@chaski.pe');
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('reenvío de recovery: usa requestPasswordReset con redirectTo null', async () => {
    const resendSignupOtp = vi.fn();
    const requestPasswordReset = vi.fn().mockResolvedValue({ error: null });

    const outcome = await runOtpResend({
      email: 'viajero@chaski.pe',
      mode: 'recovery',
      busy: false,
      resendSignupOtp,
      requestPasswordReset,
    });

    expect(outcome).toEqual({ status: 'resent' });
    expect(requestPasswordReset).toHaveBeenCalledWith('viajero@chaski.pe', { redirectTo: null });
    expect(resendSignupOtp).not.toHaveBeenCalled();
  });

  it('guardas (loading/resending/cooldown): «ignored» sin llamadas', async () => {
    const onStarting = vi.fn();
    const resendSignupOtp = vi.fn();

    const outcome = await runOtpResend({
      email: 'viajero@chaski.pe',
      mode: 'signup',
      busy: true,
      onStarting,
      resendSignupOtp,
      requestPasswordReset: vi.fn(),
    });

    expect(outcome).toEqual({ status: 'ignored' });
    expect(onStarting).not.toHaveBeenCalled();
    expect(resendSignupOtp).not.toHaveBeenCalled();
  });

  it('sin correo en reenvío: fallo con su copy propio (phase resend)', async () => {
    const outcome = await runOtpResend({
      email: '',
      mode: 'recovery',
      busy: false,
      resendSignupOtp: vi.fn(),
      requestPasswordReset: vi.fn(),
    });

    expect(outcome).toEqual({
      status: 'error',
      phase: 'resend',
      kind: 'missing-email',
      detail: null,
    });
  });

  it('error del servidor al reenviar: conserva el mensaje devuelto', async () => {
    const outcome = await runOtpResend({
      email: 'viajero@chaski.pe',
      mode: 'signup',
      busy: false,
      resendSignupOtp: vi.fn().mockResolvedValue({ error: { message: 'Rate limit' } }),
      requestPasswordReset: vi.fn(),
    });

    expect(outcome).toEqual({
      status: 'error',
      phase: 'resend',
      kind: 'server',
      detail: 'Rate limit',
    });
  });
});

describe('use-otp-verification — copy visible (textos 1:1)', () => {
  it('otpErrorMessage resuelve cada caso con el texto histórico', () => {
    expect(
      otpErrorMessage({ status: 'error', phase: 'verify', kind: 'missing-email', detail: null }),
    ).toBe('No se identificó el correo electrónico. Por favor, solicita el código nuevamente.');

    expect(
      otpErrorMessage({ status: 'error', phase: 'resend', kind: 'missing-email', detail: null }),
    ).toBe('No se identificó el correo electrónico para reenviar el código.');

    expect(
      otpErrorMessage({
        status: 'error',
        phase: 'verify',
        kind: 'invalid-format',
        detail: 'Mensaje de validación',
      }),
    ).toBe('Mensaje de validación');

    expect(
      otpErrorMessage({ status: 'error', phase: 'verify', kind: 'invalid-format', detail: null }),
    ).toBe('Ingresa un código de 6 dígitos válido');

    expect(
      otpErrorMessage({ status: 'error', phase: 'verify', kind: 'server', detail: 'Del servidor' }),
    ).toBe('Del servidor');

    expect(
      otpErrorMessage({ status: 'error', phase: 'verify', kind: 'server', detail: null }),
    ).toBe('');
  });

  it('el copy de feedback del reenvío es exactamente el histórico por modo', () => {
    expect(OTP_FEEDBACK_MESSAGES.signup).toBe(
      'Se ha reenviado el código de confirmación a tu correo.',
    );
    expect(OTP_FEEDBACK_MESSAGES.recovery).toBe(
      'Se ha enviado un nuevo código de 6 dígitos a tu correo.',
    );
  });
});

describe('use-otp-cooldown — lógica real del temporizador', () => {
  it('tickCooldown decrementa hasta 0 y se estanca', () => {
    expect(OTP_COOLDOWN_SECONDS).toBe(60);
    expect(tickCooldown(60)).toBe(59);
    expect(tickCooldown(1)).toBe(0);
    expect(tickCooldown(0)).toBe(0);
    expect(tickCooldown(-3)).toBe(0);
  });
});

describe('otp-validation — sanitizeOtpInput', () => {
  it('conserva solo dígitos, máximo 6', () => {
    expect(sanitizeOtpInput('1a2b3c4d5e6f7')).toBe('123456');
    expect(sanitizeOtpInput('abc')).toBe('');
    expect(sanitizeOtpInput('')).toBe('');
    expect(sanitizeOtpInput(undefined as unknown as string)).toBe('');
    expect(sanitizeOtpInput('987654321')).toBe('987654');
  });
});
