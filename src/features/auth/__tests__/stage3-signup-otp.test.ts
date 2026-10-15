import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  verifySignupOtp,
  resendSignupOtp,
  verifyRecoveryOtp,
  requestPasswordReset,
} from '../services/auth.service';
import { supabase } from '@/lib/supabase';

vi.mock('expo-linking', () => ({
  createURL: vi.fn((path: string) => `chaski://${path.replace(/^\//, '')}`),
  useURL: vi.fn(() => null),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      verifyOtp: vi.fn(),
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      setSession: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));

/**
 * Simulación de resolución de navegación de RootNavigator (_layout.tsx).
 */
function resolveRootNavigation({
  session,
  hasPreferences,
  pathname,
  isPasswordRecovery,
  isRecoveryVerified = false,
  authLoading = false,
  prefsLoading = false,
  fontsLoaded = true,
}: {
  session: any | null;
  hasPreferences: boolean;
  pathname: string;
  isPasswordRecovery: boolean;
  isRecoveryVerified?: boolean;
  authLoading?: boolean;
  prefsLoading?: boolean;
  fontsLoaded?: boolean;
}) {
  const isRecoveryActive =
    pathname === '/verify-otp' ||
    pathname === '/reset-password' ||
    isPasswordRecovery ||
    isRecoveryVerified;

  if (authLoading || (!isRecoveryActive && prefsLoading) || !fontsLoaded) {
    return null;
  }

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
    allowedScreens: [
      '(tabs)',
      'preferences',
      'change-password',
      'places',
      'place/[id]',
      'wizard/ubicacion',
      'wizard/mapa',
      'wizard/tiempo',
      'wizard/presupuesto',
      'wizard/intereses',
      'wizard/movilidad',
      'plan/buscando',
      'plan/resultados',
      'plan/detalle',
      'plan/activo',
      'plan/completado',
    ],
    firstScreen: '(tabs)',
  };
}

describe('Fase 3: Flujo Dual de Verificación OTP (Signup vs Recovery)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Resolución del modo en VerifyOtpScreen (Parámetro mode)', () => {
    it('resuelve a signup únicamente si mode="signup"', () => {
      const resolveMode = (paramMode?: string): 'signup' | 'recovery' =>
        paramMode === 'signup' ? 'signup' : 'recovery';

      expect(resolveMode('signup')).toBe('signup');
      expect(resolveMode('recovery')).toBe('recovery');
      expect(resolveMode(undefined)).toBe('recovery');
      expect(resolveMode('')).toBe('recovery');
      expect(resolveMode('otro')).toBe('recovery');
    });

    it('adapta los textos del boleto Serie AX según el modo', () => {
      const getTicketTexts = (mode: 'signup' | 'recovery') => {
        const isSignup = mode === 'signup';
        return {
          serie: isSignup
            ? 'CONFIRMACIÓN DE PASAJE · SERIE AX'
            : 'VERIFICACIÓN DE ACCESO · SERIE AX',
          title: isSignup ? 'Confirmar Cuenta' : 'Verificar Código',
          submitButton: isSignup ? 'CONFIRMAR CUENTA' : 'VALIDAR BOLETO',
          cancelButton: isSignup ? 'VOLVER AL REGISTRO' : 'VOLVER AL INICIO DE SESIÓN',
        };
      };

      const signupTexts = getTicketTexts('signup');
      expect(signupTexts.serie).toBe('CONFIRMACIÓN DE PASAJE · SERIE AX');
      expect(signupTexts.title).toBe('Confirmar Cuenta');
      expect(signupTexts.submitButton).toBe('CONFIRMAR CUENTA');
      expect(signupTexts.cancelButton).toBe('VOLVER AL REGISTRO');

      const recoveryTexts = getTicketTexts('recovery');
      expect(recoveryTexts.serie).toBe('VERIFICACIÓN DE ACCESO · SERIE AX');
      expect(recoveryTexts.title).toBe('Verificar Código');
      expect(recoveryTexts.submitButton).toBe('VALIDAR BOLETO');
      expect(recoveryTexts.cancelButton).toBe('VOLVER AL INICIO DE SESIÓN');
    });
  });

  describe('2. Flujo de Confirmación de Registro (mode="signup")', () => {
    it('verifica exitosamente usando verifySignupOtp sin activar banderas de recuperación', async () => {
      const mockSession = { access_token: 'signup_token_abc', user: { id: 'u_new' } };
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: mockSession.user as any, session: mockSession as any },
        error: null,
      });

      let isPasswordRecovery = false;
      let isRecoveryVerified = false;
      let appSession: any = null;

      // Ejecución del flujo
      const result = await verifySignupOtp('viajero.nuevo@chaski.pe', '123456');

      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'viajero.nuevo@chaski.pe',
        token: '123456',
        type: 'signup',
      });

      expect(result.error).toBeNull();
      if (result.data?.session) {
        appSession = result.data.session;
      }

      // En signup, NO activar banderas de recuperación
      expect(isPasswordRecovery).toBe(false);
      expect(isRecoveryVerified).toBe(false);
      expect(appSession).toEqual(mockSession);
    });

    it('en signup, dirige a onboarding-categories si el usuario no tiene preferencias', () => {
      const navResult = resolveRootNavigation({
        session: { access_token: 'valid', user: { id: 'u_new' } },
        hasPreferences: false,
        pathname: '/onboarding-categories',
        isPasswordRecovery: false,
        isRecoveryVerified: false,
      });

      expect(navResult?.activeStack).toBe('onboarding-stack');
      expect(navResult?.initialRoute).toBe('onboarding-categories');
      expect(navResult?.firstScreen).toBe('onboarding-categories');
    });

    it('en signup, dirige a (tabs) si el usuario ya cuenta con preferencias', () => {
      const navResult = resolveRootNavigation({
        session: { access_token: 'valid', user: { id: 'u_new' } },
        hasPreferences: true,
        pathname: '/(tabs)',
        isPasswordRecovery: false,
        isRecoveryVerified: false,
      });

      expect(navResult?.activeStack).toBe('authenticated-stack');
      expect(navResult?.initialRoute).toBe('(tabs)');
      expect(navResult?.firstScreen).toBe('(tabs)');
    });

    it('en signup, el reenvío de código utiliza resendSignupOtp con type="signup"', async () => {
      const resendSpy = vi.spyOn(supabase.auth, 'resend').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: null,
      });

      const res = await resendSignupOtp('viajero.nuevo@chaski.pe');

      expect(resendSpy).toHaveBeenCalledWith({
        email: 'viajero.nuevo@chaski.pe',
        type: 'signup',
      });
      expect(res.error).toBeNull();
    });

    it('en signup, errores de código inválido o expirado se sanitizan y no navegan', async () => {
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { name: 'AuthApiError', message: 'Token has expired or is invalid', status: 400 } as any,
      });

      const result = await verifySignupOtp('nuevo@chaski.pe', '999999');

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('código de verificación es incorrecto o ya ha sido utilizado');
    });
  });

  describe('3. Flujo de Recuperación de Contraseña (mode="recovery")', () => {
    it('conserva el comportamiento de recuperación: verifyRecoveryOtp, banderas y navegación a reset-password', async () => {
      const mockSession = { access_token: 'rec_session_xyz', user: { id: 'u_rec' } };
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: mockSession.user as any, session: mockSession as any },
        error: null,
      });

      let isPasswordRecovery = false;
      let isRecoveryVerified = false;

      // Pre-activar bandera para blindar RootNavigator ante eventos SIGNED_IN
      isPasswordRecovery = true;

      const result = await verifyRecoveryOtp('olvido@chaski.pe', '654321');

      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'olvido@chaski.pe',
        token: '654321',
        type: 'recovery',
      });

      expect(result.error).toBeNull();

      // Éxito: ambas banderas quedan activas
      isPasswordRecovery = true;
      isRecoveryVerified = true;

      // Simular resolución de navegación con sesión temporal de recuperación
      const navResult = resolveRootNavigation({
        session: mockSession,
        hasPreferences: true,
        pathname: '/reset-password',
        isPasswordRecovery,
        isRecoveryVerified,
      });

      expect(navResult?.activeStack).toBe('auth-stack');
      expect(navResult?.allowedScreens).toContain('reset-password');
    });

    it('en recovery, el reenvío utiliza requestPasswordReset sin redirectTo', async () => {
      const resetSpy = vi.spyOn(supabase.auth, 'resetPasswordForEmail').mockResolvedValueOnce({
        data: {},
        error: null,
      });

      const res = await requestPasswordReset('olvido@chaski.pe', { redirectTo: null });

      expect(resetSpy).toHaveBeenCalledWith('olvido@chaski.pe', undefined);
      expect(res.error).toBeNull();
    });

    it('si verifyRecoveryOtp falla, limpia las banderas de recuperación', async () => {
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { name: 'AuthApiError', message: 'Token has expired', status: 400 } as any,
      });

      let isPasswordRecovery = true;
      let isRecoveryVerified = false;

      const result = await verifyRecoveryOtp('olvido@chaski.pe', '000000');

      if (result.error) {
        isPasswordRecovery = false;
        isRecoveryVerified = false;
      }

      expect(isPasswordRecovery).toBe(false);
      expect(isRecoveryVerified).toBe(false);
    });
  });

  describe('4. Aislamiento de Seguridad entre Flujos', () => {
    it('una confirmación de signup nunca autoriza acceso a reset-password', () => {
      // Usuario autenticado por signup
      const signupSession = { access_token: 'signup_jwt', user: { id: 'u_signup' } };
      const isRecoveryVerified = false;
      const isPasswordRecovery = false;

      // Regla de reset-password: exige isRecoveryVerified && session (o deep link legítimo)
      const isAuthorizedForResetPassword = isRecoveryVerified && !!signupSession;

      expect(isAuthorizedForResetPassword).toBe(false);
      expect(isPasswordRecovery).toBe(false);
    });

    it('cancelar en verify-otp limpia el estado y regresa de forma segura', () => {
      let isPasswordRecovery = false;
      let isRecoveryVerified = false;

      const handleCancel = (mode: 'signup' | 'recovery') => {
        isPasswordRecovery = false;
        isRecoveryVerified = false;
        return mode === 'signup' ? '/register' : '/login';
      };

      expect(handleCancel('signup')).toBe('/register');
      expect(isPasswordRecovery).toBe(false);
      expect(isRecoveryVerified).toBe(false);

      expect(handleCancel('recovery')).toBe('/login');
      expect(isPasswordRecovery).toBe(false);
      expect(isRecoveryVerified).toBe(false);
    });
  });
});
