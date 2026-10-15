import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  requestPasswordReset,
  verifyRecoveryOtp,
  verifySignupOtp,
  resendSignupOtp,
  getResetPasswordRedirectUrl,
} from '../services/auth.service';
import {
  normalizeEmail,
  validateOtpFormat,
  sanitizeAuthError,
} from '../utils/otp-validation';
import { supabase } from '@/lib/supabase';

vi.mock('expo-linking', () => ({
  createURL: vi.fn((path: string) => `chaski://${path.replace(/^\//, '')}`),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      resend: vi.fn(),
    },
  },
}));

describe('Servicios y Utilidades de Recuperación por OTP (Etapa 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Normalización y Validación de Formato OTP', () => {
    it('normaliza correos eliminando espacios en blanco y pasando a minúsculas', () => {
      expect(normalizeEmail('  Viajero.Chaski@GMAIL.COM  ')).toBe('viajero.chaski@gmail.com');
      expect(normalizeEmail('Turista@Peru.pe')).toBe('turista@peru.pe');
      expect(normalizeEmail('')).toBe('');
      expect(normalizeEmail(null as any)).toBe('');
      expect(normalizeEmail(undefined as any)).toBe('');
    });

    it('acepta códigos de exactamente 6 dígitos numéricos', () => {
      expect(validateOtpFormat('123456')).toEqual({ isValid: true });
      expect(validateOtpFormat('000000')).toEqual({ isValid: true });
      expect(validateOtpFormat('987654')).toEqual({ isValid: true });
      expect(validateOtpFormat(' 654321 ')).toEqual({ isValid: true });
    });

    it('rechaza códigos con longitud distinta a 6 dígitos', () => {
      const shortRes = validateOtpFormat('12345');
      expect(shortRes.isValid).toBe(false);
      expect(shortRes.error).toContain('6 dígitos');

      const longRes = validateOtpFormat('1234567');
      expect(longRes.isValid).toBe(false);
      expect(longRes.error).toContain('6 dígitos');
    });

    it('rechaza códigos con caracteres no numéricos o vacíos', () => {
      expect(validateOtpFormat('12a456').isValid).toBe(false);
      expect(validateOtpFormat('12-456').isValid).toBe(false);
      expect(validateOtpFormat('abcdef').isValid).toBe(false);
      expect(validateOtpFormat('').isValid).toBe(false);
      expect(validateOtpFormat('   ').isValid).toBe(false);
      expect(validateOtpFormat(null as any).isValid).toBe(false);
    });
  });

  describe('2. Sanitización Segura de Errores de Autenticación', () => {
    it('sanitiza errores de límite de frecuencia (rate limit / too many requests)', () => {
      const err429 = sanitizeAuthError({ status: 429, message: 'Too many requests' });
      expect(err429.message).toContain('límite de intentos');

      const errRate = sanitizeAuthError({ message: 'Over email send rate limit' });
      expect(errRate.message).toContain('límite de intentos');
    });

    it('sanitiza errores de código expirado', () => {
      const errExp = sanitizeAuthError({ message: 'Token has expired' });
      expect(errExp.message).toContain('ha expirado');
    });

    it('sanitiza errores de código inválido o reutilizado', () => {
      const errInv = sanitizeAuthError({ message: 'Token is invalid or has expired' });
      expect(errInv.message).toContain('incorrecto o ya ha sido utilizado');

      const err400 = sanitizeAuthError({ status: 400, message: 'Bad request token error' });
      expect(err400.message).toContain('incorrecto o ya ha sido utilizado');
    });

    it('retorna mensaje seguro genérico para errores no catalogados sin exponer secretos', () => {
      const errGeneric = sanitizeAuthError({ message: 'Internal postgres error code 500' });
      expect(errGeneric.message).not.toContain('postgres');
      expect(errGeneric.message).toContain('No se pudo verificar el código');
    });
  });

  describe('3. Solicitud de Recuperación OTP (requestPasswordReset)', () => {
    it('solicita OTP puro sin redirectTo cuando se pasa redirectTo: null', async () => {
      const resetSpy = vi
        .spyOn(supabase.auth, 'resetPasswordForEmail')
        .mockResolvedValueOnce({ data: {}, error: null });

      const res = await requestPasswordReset('  pasajero@chaski.pe  ', { redirectTo: null });

      expect(resetSpy).toHaveBeenCalledWith('pasajero@chaski.pe', undefined);
      expect(res.error).toBeNull();
    });

    it('solicita OTP puro pasando null directamente como segundo argumento', async () => {
      const resetSpy = vi
        .spyOn(supabase.auth, 'resetPasswordForEmail')
        .mockResolvedValueOnce({ data: {}, error: null });

      const res = await requestPasswordReset('turista@chaski.pe', null);

      expect(resetSpy).toHaveBeenCalledWith('turista@chaski.pe', undefined);
      expect(res.error).toBeNull();
    });

    it('mantiene retrocompatibilidad con redirectTo por defecto cuando no se especifica', async () => {
      const resetSpy = vi
        .spyOn(supabase.auth, 'resetPasswordForEmail')
        .mockResolvedValueOnce({ data: {}, error: null });

      const res = await requestPasswordReset('turista@chaski.pe');

      expect(resetSpy).toHaveBeenCalledWith('turista@chaski.pe', {
        redirectTo: getResetPasswordRedirectUrl(),
      });
      expect(res.error).toBeNull();
    });

    it('mantiene retrocompatibilidad con redirectTo personalizado cuando se envía como string', async () => {
      const resetSpy = vi
        .spyOn(supabase.auth, 'resetPasswordForEmail')
        .mockResolvedValueOnce({ data: {}, error: null });

      const res = await requestPasswordReset('turista@chaski.pe', 'chaski://custom-redirect');

      expect(resetSpy).toHaveBeenCalledWith('turista@chaski.pe', {
        redirectTo: 'chaski://custom-redirect',
      });
      expect(res.error).toBeNull();
    });
  });

  describe('4. Verificación de Código de Recuperación (verifyRecoveryOtp)', () => {
    it('verifica exitosamente el código de 6 dígitos con type recovery', async () => {
      const mockSession = { access_token: 'rec_access_token', user: { id: 'usr_abc' } };
      const verifySpy = vi
        .spyOn(supabase.auth, 'verifyOtp')
        .mockResolvedValueOnce({
          data: { user: mockSession.user as any, session: mockSession as any },
          error: null,
        });

      const res = await verifyRecoveryOtp('  Pasajero@Chaski.Pe ', ' 654321 ');

      expect(verifySpy).toHaveBeenCalledWith({
        email: 'pasajero@chaski.pe',
        token: '654321',
        type: 'recovery',
      });
      expect(res.error).toBeNull();
      expect(res.data.session).toEqual(mockSession);
    });

    it('soporta llamada con objeto de parámetros { email, token }', async () => {
      const verifySpy = vi
        .spyOn(supabase.auth, 'verifyOtp')
        .mockResolvedValueOnce({
          data: { user: {} as any, session: {} as any },
          error: null,
        });

      const res = await verifyRecoveryOtp({
        email: 'turista@chaski.pe',
        token: '123456',
      });

      expect(verifySpy).toHaveBeenCalledWith({
        email: 'turista@chaski.pe',
        token: '123456',
        type: 'recovery',
      });
      expect(res.error).toBeNull();
    });

    it('rechaza correo electrónico con formato inválido antes de invocar a Supabase', async () => {
      const verifySpy = vi.spyOn(supabase.auth, 'verifyOtp');

      const res = await verifyRecoveryOtp('correo_invalido_sin_arroba', '123456');

      expect(verifySpy).not.toHaveBeenCalled();
      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('formato de correo válido');
    });

    it('rechaza código con formato no numérico antes de invocar a Supabase', async () => {
      const verifySpy = vi.spyOn(supabase.auth, 'verifyOtp');

      const res = await verifyRecoveryOtp('pasajero@chaski.pe', 'ABCDEF');

      expect(verifySpy).not.toHaveBeenCalled();
      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('6 dígitos numéricos');
    });

    it('rechaza código con longitud distinta a 6 antes de invocar a Supabase', async () => {
      const verifySpy = vi.spyOn(supabase.auth, 'verifyOtp');

      const res = await verifyRecoveryOtp('pasajero@chaski.pe', '12345');

      expect(verifySpy).not.toHaveBeenCalled();
      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('6 dígitos numéricos');
    });

    it('maneja y sanitiza error de código incorrecto o reutilizado devuelto por Supabase', async () => {
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: 'Token has expired or is invalid',
          status: 400,
        } as any,
      });

      const res = await verifyRecoveryOtp('pasajero@chaski.pe', '000000');

      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('incorrecto o ya ha sido utilizado');
      expect(res.error?.message).not.toContain('000000');
    });

    it('maneja y sanitiza error de código expirado devuelto por Supabase', async () => {
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: 'Token has expired',
          status: 400,
        } as any,
      });

      const res = await verifyRecoveryOtp('pasajero@chaski.pe', '999999');

      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('ha expirado');
    });

    it('maneja y sanitiza error de rate limit devuelto por Supabase', async () => {
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: 'Rate limit exceeded: please wait',
          status: 429,
        } as any,
      });

      const res = await verifyRecoveryOtp('pasajero@chaski.pe', '111111');

      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('límite de intentos');
    });
  });

  describe('5. Confirmación de Registro por OTP (verifySignupOtp)', () => {
    it('verifica exitosamente el código de 6 dígitos con type signup y emite sesión activa', async () => {
      const mockSession = { access_token: 'signup_jwt_token', user: { id: 'new_usr_1' } };
      const verifySpy = vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: mockSession.user as any, session: mockSession as any },
        error: null,
      });

      const res = await verifySignupOtp('  Nuevo.Viajero@Chaski.Pe ', ' 654321 ');

      expect(verifySpy).toHaveBeenCalledWith({
        email: 'nuevo.viajero@chaski.pe',
        token: '654321',
        type: 'signup',
      });
      expect(res.error).toBeNull();
      expect(res.data.session).toEqual(mockSession);
    });

    it('soporta invocación pasando objeto { email, token }', async () => {
      const verifySpy = vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: {} as any, session: {} as any },
        error: null,
      });

      const res = await verifySignupOtp({
        email: 'viajero@chaski.pe',
        token: '890123',
      });

      expect(verifySpy).toHaveBeenCalledWith({
        email: 'viajero@chaski.pe',
        token: '890123',
        type: 'signup',
      });
      expect(res.error).toBeNull();
    });

    it('rechaza correo inválido antes de invocar a Supabase', async () => {
      const verifySpy = vi.spyOn(supabase.auth, 'verifyOtp');

      const res = await verifySignupOtp('email_sin_arroba', '123456');

      expect(verifySpy).not.toHaveBeenCalled();
      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('formato de correo válido');
    });

    it('rechaza código no numérico antes de invocar a Supabase', async () => {
      const verifySpy = vi.spyOn(supabase.auth, 'verifyOtp');

      const res = await verifySignupOtp('nuevo@chaski.pe', 'XYZ123');

      expect(verifySpy).not.toHaveBeenCalled();
      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('6 dígitos numéricos');
    });

    it('rechaza código con longitud diferente a 6 antes de invocar a Supabase', async () => {
      const verifySpy = vi.spyOn(supabase.auth, 'verifyOtp');

      const res = await verifySignupOtp('nuevo@chaski.pe', '12345');

      expect(verifySpy).not.toHaveBeenCalled();
      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('6 dígitos numéricos');
    });

    it('maneja y sanitiza error de código incorrecto o reutilizado devuelto por Supabase', async () => {
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: 'Token has expired or is invalid',
          status: 400,
        } as any,
      });

      const res = await verifySignupOtp('nuevo@chaski.pe', '000000');

      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('incorrecto o ya ha sido utilizado');
      expect(res.error?.message).not.toContain('000000');
    });

    it('maneja y sanitiza error de código expirado devuelto por Supabase', async () => {
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: 'Token has expired',
          status: 400,
        } as any,
      });

      const res = await verifySignupOtp('nuevo@chaski.pe', '777777');

      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('ha expirado');
    });

    it('maneja y sanitiza error de límite de intentos devuelto por Supabase', async () => {
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: 'Over email send rate limit',
          status: 429,
        } as any,
      });

      const res = await verifySignupOtp('nuevo@chaski.pe', '888888');

      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('límite de intentos');
    });
  });

  describe('6. Reenvío de Código de Registro (resendSignupOtp)', () => {
    it('reenvía código exitosamente con type signup y normaliza el correo', async () => {
      const resendSpy = vi.spyOn(supabase.auth, 'resend').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: null,
      });

      const res = await resendSignupOtp('  Nuevo.Viajero@Chaski.Pe ');

      expect(resendSpy).toHaveBeenCalledWith({
        email: 'nuevo.viajero@chaski.pe',
        type: 'signup',
      });
      expect(res.error).toBeNull();
    });

    it('soporta invocación pasando objeto { email }', async () => {
      const resendSpy = vi.spyOn(supabase.auth, 'resend').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: null,
      });

      const res = await resendSignupOtp({ email: 'viajero@chaski.pe' });

      expect(resendSpy).toHaveBeenCalledWith({
        email: 'viajero@chaski.pe',
        type: 'signup',
      });
      expect(res.error).toBeNull();
    });

    it('rechaza correo inválido antes de llamar a Supabase', async () => {
      const resendSpy = vi.spyOn(supabase.auth, 'resend');

      const res = await resendSignupOtp('correo_invalido');

      expect(resendSpy).not.toHaveBeenCalled();
      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('formato de correo válido');
    });

    it('maneja y sanitiza error de rate limit en reenvío devuelto por Supabase', async () => {
      vi.spyOn(supabase.auth, 'resend').mockResolvedValueOnce({
        data: null as any,
        error: {
          name: 'AuthApiError',
          message: 'For security purposes, you can only request this after 60 seconds.',
          status: 429,
        } as any,
      });

      const res = await resendSignupOtp('nuevo@chaski.pe');

      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('límite de intentos');
    });

    it('maneja y sanitiza errores no catalogados en reenvío sin exponer detalles internos', async () => {
      vi.spyOn(supabase.auth, 'resend').mockResolvedValueOnce({
        data: null as any,
        error: {
          name: 'AuthApiError',
          message: 'Internal server database error 500',
          status: 500,
        } as any,
      });

      const res = await resendSignupOtp('nuevo@chaski.pe');

      expect(res.error).toBeDefined();
      expect(res.error?.message).not.toContain('database');
    });
  });
});
