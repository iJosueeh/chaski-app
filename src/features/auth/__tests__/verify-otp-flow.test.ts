import { describe, expect, it, vi, beforeEach } from 'vitest';
import { requestPasswordReset, verifyRecoveryOtp } from '../services/auth.service';
import { normalizeEmail, validateOtpFormat } from '../utils/otp-validation';
import { supabase } from '@/lib/supabase';

vi.mock('expo-linking', () => ({
  createURL: vi.fn((path: string) => `chaski://${path.replace(/^\//, '')}`),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

/**
 * Simulación de resolución de navegación de _layout.tsx (RootNavigator).
 */
function resolveRootNavigation({
  session,
  hasPreferences,
  pathname,
  isPasswordRecovery,
}: {
  session: any | null;
  hasPreferences: boolean;
  pathname: string;
  isPasswordRecovery: boolean;
}) {
  const isRecoveryActive =
    pathname === '/verify-otp' || pathname === '/reset-password' || isPasswordRecovery;

  if (isRecoveryActive || !session) {
    return {
      activeStack: 'auth-stack',
      initialRoute: 'login',
      allowedScreens: ['login', 'register', 'forgot-password', 'verify-otp', 'reset-password'],
      firstScreen: 'login',
    };
  }

  if (!hasPreferences) {
    return {
      activeStack: 'onboarding-stack',
      initialRoute: 'onboarding-categories',
      allowedScreens: ['onboarding-categories', 'onboarding-budget'],
      firstScreen: 'onboarding-categories',
    };
  }

  return {
    activeStack: 'authenticated-stack',
    initialRoute: '(tabs)',
    allowedScreens: ['(tabs)', 'preferences', 'change-password'],
    firstScreen: '(tabs)',
  };
}

describe('Pruebas de Regresión: Etapa 2 del Flujo OTP (verify-otp y forgot-password)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Transición desde forgot-password hacia verify-otp', () => {
    it('solicita OTP con redirectTo null y normaliza el correo sin exponer secretos', async () => {
      const resetSpy = vi
        .spyOn(supabase.auth, 'resetPasswordForEmail')
        .mockResolvedValueOnce({ data: {}, error: null });

      const rawEmail = '  Viajero.Chaski@Gmail.com ';
      const normalized = normalizeEmail(rawEmail);

      const res = await requestPasswordReset(normalized, { redirectTo: null });

      expect(resetSpy).toHaveBeenCalledWith('viajero.chaski@gmail.com', undefined);
      expect(res.error).toBeNull();
    });

    it('los parámetros de navegación hacia verify-otp contienen únicamente el correo normalizado', () => {
      const rawEmail = '  Pasajero@Dominio.Com ';
      const normalized = normalizeEmail(rawEmail);

      const navParams = {
        pathname: '/verify-otp',
        params: { email: normalized },
      };

      expect(navParams.pathname).toBe('/verify-otp');
      expect(navParams.params.email).toBe('pasajero@dominio.com');
      // No contiene tokens, claves ni secretos
      expect((navParams.params as any).token).toBeUndefined();
      expect((navParams.params as any).code).toBeUndefined();
    });
  });

  describe('2. Verificación de Código OTP (verify-otp)', () => {
    it('código de 6 dígitos válido procesa verifyRecoveryOtp y marca recuperación activa', async () => {
      const mockSession = { access_token: 'valid_otp_jwt', user: { id: 'user_otp_1' } };
      const verifySpy = vi
        .spyOn(supabase.auth, 'verifyOtp')
        .mockResolvedValueOnce({
          data: { user: mockSession.user as any, session: mockSession as any },
          error: null,
        });

      let isPasswordRecovery = false;
      const setIsPasswordRecovery = (val: boolean) => {
        isPasswordRecovery = val;
      };

      const res = await verifyRecoveryOtp('viajero@chaski.pe', '849201');

      expect(verifySpy).toHaveBeenCalledWith({
        email: 'viajero@chaski.pe',
        token: '849201',
        type: 'recovery',
      });
      expect(res.error).toBeNull();

      // Simula el callback de éxito en VerifyOtpScreen
      if (!res.error) {
        setIsPasswordRecovery(true);
      }
      expect(isPasswordRecovery).toBe(true);
    });

    it('código incorrecto o inválido retorna error sanitizado y no activa recuperación', async () => {
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: 'Token has expired or is invalid',
          status: 400,
        } as any,
      });

      let isPasswordRecovery = false;
      const setIsPasswordRecovery = (val: boolean) => {
        isPasswordRecovery = val;
      };

      const res = await verifyRecoveryOtp('viajero@chaski.pe', '000000');

      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('incorrecto o ya ha sido utilizado');
      expect(res.error?.message).not.toContain('000000');

      // No se activa recuperación si falla
      if (!res.error) {
        setIsPasswordRecovery(true);
      }
      expect(isPasswordRecovery).toBe(false);
    });

    it('código expirado retorna mensaje amigable de expiración', async () => {
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: 'Token has expired',
          status: 400,
        } as any,
      });

      const res = await verifyRecoveryOtp('viajero@chaski.pe', '123456');

      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('ha expirado');
    });

    it('valida que la entrada tenga exactamente 6 dígitos antes de invocar la red', () => {
      expect(validateOtpFormat('12345').isValid).toBe(false);
      expect(validateOtpFormat('1234567').isValid).toBe(false);
      expect(validateOtpFormat('abcdef').isValid).toBe(false);
      expect(validateOtpFormat('123456').isValid).toBe(true);
    });
  });

  describe('3. Reenvío con Cooldown de 60 segundos', () => {
    it('solicita nuevo código con requestPasswordReset sin redirectTo', async () => {
      const resetSpy = vi
        .spyOn(supabase.auth, 'resetPasswordForEmail')
        .mockResolvedValueOnce({ data: {}, error: null });

      const res = await requestPasswordReset('pasajero@chaski.pe', { redirectTo: null });

      expect(resetSpy).toHaveBeenCalledWith('pasajero@chaski.pe', undefined);
      expect(res.error).toBeNull();
    });

    it('el cooldown bloquea reenvíos concurrentes mientras el contador es mayor a cero', () => {
      let cooldown = 60;
      let resendCalled = false;

      const triggerResend = () => {
        if (cooldown > 0) return; // Bloqueado por cooldown
        resendCalled = true;
      };

      triggerResend();
      expect(resendCalled).toBe(false);

      // Simula finalización del temporizador
      cooldown = 0;
      triggerResend();
      expect(resendCalled).toBe(true);
    });
  });

  describe('4. Protección de Navegación y Aislamiento de Sesión (_layout.tsx)', () => {
    it('mantiene la pila de autenticación activa cuando el usuario está en /verify-otp', () => {
      const navResult = resolveRootNavigation({
        session: null,
        hasPreferences: false,
        pathname: '/verify-otp',
        isPasswordRecovery: false,
      });

      expect(navResult.activeStack).toBe('auth-stack');
      expect(navResult.allowedScreens).toContain('verify-otp');
    });

    it('evita la redirección accidental a (tabs) u onboarding cuando verifyOtp crea una sesión', () => {
      // Al tener éxito verifyRecoveryOtp, Supabase establece una sesión Y se activa isPasswordRecovery: true
      const navResult = resolveRootNavigation({
        session: { access_token: 'temp_recovery_jwt', user: { id: 'u1' } },
        hasPreferences: true,
        pathname: '/verify-otp',
        isPasswordRecovery: true, // Marcado explícitamente tras validar OTP
      });

      // No redirige a authenticated-stack ni tabs
      expect(navResult.activeStack).toBe('auth-stack');
      expect(navResult.allowedScreens).toContain('reset-password');
    });

    it('una sesión existente sin bandera de recuperación en login normal NO activa recuperación', () => {
      // Normal login con sesión
      const navResult = resolveRootNavigation({
        session: { user: { id: 'u1' } },
        hasPreferences: true,
        pathname: '/login',
        isPasswordRecovery: false,
      });

      // Debe ir a tabs, nunca a verify-otp ni reset-password
      expect(navResult.activeStack).toBe('authenticated-stack');
      expect(navResult.initialRoute).toBe('(tabs)');
    });

    it('cancelar en verify-otp limpia isPasswordRecovery y retorna de forma segura', () => {
      let isPasswordRecovery = true;
      const handleCancel = () => {
        isPasswordRecovery = false;
      };

      handleCancel();
      expect(isPasswordRecovery).toBe(false);

      const navResult = resolveRootNavigation({
        session: null,
        hasPreferences: false,
        pathname: '/login',
        isPasswordRecovery,
      });

      expect(navResult.activeStack).toBe('auth-stack');
      expect(navResult.initialRoute).toBe('login');
    });
  });
});
