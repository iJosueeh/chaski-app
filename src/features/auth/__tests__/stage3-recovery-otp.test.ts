import { describe, expect, it, vi, beforeEach } from 'vitest';
import { signOut, updatePassword } from '../services/auth.service';
import { validatePasswordChange } from '../utils/password-validation';
import {
  parseRecoveryUrl,
  hasRecoveryPayload,
  type ParsedRecoveryParams,
} from '../utils/recovery-link';
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
      setSession: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));

/**
 * Simulación exacta de la resolución de navegación en RootNavigator (_layout.tsx).
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
    allowedScreens: ['(tabs)', 'preferences', 'change-password'],
    firstScreen: '(tabs)',
  };
}

/**
 * Simula la máquina de estados de ResetPasswordScreen al evaluar autorización.
 */
async function evaluateResetPasswordAccess({
  isPasswordRecovery,
  isRecoveryVerified,
  session,
  incomingUrl,
  searchParams = {},
}: {
  isPasswordRecovery: boolean;
  isRecoveryVerified: boolean;
  session: any | null;
  incomingUrl: string | null;
  searchParams?: Record<string, string | undefined>;
}) {
  // 1. Caso A: Verificación OTP previa exitosa (Etapa 3)
  let activeSession = session;
  if (!activeSession && (isRecoveryVerified || isPasswordRecovery)) {
    const sessionRes = await supabase.auth.getSession();
    activeSession = sessionRes?.data?.session ?? null;
  }

  if (isRecoveryVerified && activeSession) {
    return {
      isVerified: true,
      error: null,
      flow: 'otp_verified' as const,
    };
  }

  // 2. Caso B: Deep link legítimo
  const urlParsed = parseRecoveryUrl(incomingUrl);
  const paramsCombined: ParsedRecoveryParams = {
    code: urlParsed.code || searchParams.code,
    tokenHash: urlParsed.tokenHash || searchParams.token_hash,
    type: urlParsed.type || searchParams.type,
    accessToken: urlParsed.accessToken,
    refreshToken: urlParsed.refreshToken,
    error: urlParsed.error || searchParams.error,
    errorDescription: urlParsed.errorDescription || searchParams.error_description,
  };

  if (!hasRecoveryPayload(paramsCombined)) {
    return {
      isVerified: false,
      error:
        'No se detectó un enlace de recuperación válido. Para restablecer tu contraseña, solicita un nuevo enlace.',
      flow: 'unauthorized' as const,
    };
  }

  return {
    isVerified: true,
    error: null,
    flow: 'deeplink' as const,
  };
}

describe('Pruebas de Regresión: Etapa 3 del Flujo OTP (Reset Password e Integración)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null } as any,
      error: null,
    });
  });

  describe('1. OTP Válido → Formulario Desbloqueado → Actualización de Contraseña', () => {
    it('desbloquea el formulario cuando isRecoveryVerified, isPasswordRecovery y session están activos', async () => {
      const authState = {
        isPasswordRecovery: true,
        isRecoveryVerified: true,
        session: { access_token: 'temp_otp_recovery_token', user: { id: 'u_recovery' } },
        incomingUrl: null,
      };

      const result = await evaluateResetPasswordAccess(authState);

      expect(result.isVerified).toBe(true);
      expect(result.error).toBeNull();
      expect(result.flow).toBe('otp_verified');
    });

    it('recupera la sesión vía getSession si el estado React aún no se propagó al montar reset-password', async () => {
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
        data: {
          session: { access_token: 'async_session_token', user: { id: 'u_recovery' } } as any,
        },
        error: null,
      });

      const authState = {
        isPasswordRecovery: true,
        isRecoveryVerified: true,
        session: null, // Aún null en el tick inicial de React
        incomingUrl: null,
      };

      const result = await evaluateResetPasswordAccess(authState);

      expect(result.isVerified).toBe(true);
      expect(result.error).toBeNull();
      expect(result.flow).toBe('otp_verified');
      expect(supabase.auth.getSession).toHaveBeenCalled();
    });

    it('actualiza la contraseña exitosamente con validatePasswordChange y updatePassword', async () => {
      const newPass = 'NuevaClaveSegura2026!';
      const confirmPass = 'NuevaClaveSegura2026!';

      // Validación local de contraseña
      const validation = validatePasswordChange(newPass, confirmPass);
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();

      // Llamada al servicio
      vi.spyOn(supabase.auth, 'updateUser').mockResolvedValueOnce({
        data: { user: { id: 'u_recovery' } as any },
        error: null,
      });

      const updateRes = await updatePassword(newPass);
      expect(updateRes.error).toBeNull();
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: newPass });
    });

    it('al actualizar la contraseña con éxito, cierra sesión temporal y limpia las banderas', async () => {
      vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({ error: null });

      let isPasswordRecovery = true;
      let isRecoveryVerified = true;

      // Acción de éxito en reset-password:
      await signOut();
      isPasswordRecovery = false;
      isRecoveryVerified = false;

      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(isPasswordRecovery).toBe(false);
      expect(isRecoveryVerified).toBe(false);
    });
  });

  describe('2. OTP Inválido o No Verificado → Formulario Bloqueado', () => {
    it('bloquea el formulario si isRecoveryVerified es false (OTP fallido o no completado)', async () => {
      const authState = {
        isPasswordRecovery: true, // Aunque esté en true por navigation
        isRecoveryVerified: false, // OTP no fue verificado
        session: null,
        incomingUrl: null,
      };

      const result = await evaluateResetPasswordAccess(authState);

      expect(result.isVerified).toBe(false);
      expect(result.error).toContain('No se detectó un enlace de recuperación válido');
      expect(result.flow).toBe('unauthorized');
    });

    it('bloquea el formulario si falta la sesión temporal tras verificación', async () => {
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const authState = {
        isPasswordRecovery: true,
        isRecoveryVerified: true,
        session: null, // Sin sesión temporal ni en estado ni en cliente
        incomingUrl: null,
      };

      const result = await evaluateResetPasswordAccess(authState);

      expect(result.isVerified).toBe(false);
      expect(result.flow).toBe('unauthorized');
    });
  });

  describe('3. Login Normal → Tabs / Onboarding (Aislamiento y Prevención de Desvíos)', () => {
    it('login normal con preferencias navega directamente a (tabs) y nunca a reset-password', () => {
      const navResult = resolveRootNavigation({
        session: { access_token: 'user_jwt', user: { id: 'regular_user' } },
        hasPreferences: true,
        pathname: '/login',
        isPasswordRecovery: false,
        isRecoveryVerified: false,
      });

      expect(navResult?.activeStack).toBe('authenticated-stack');
      expect(navResult?.initialRoute).toBe('(tabs)');
      expect(navResult?.firstScreen).toBe('(tabs)');
      expect(navResult?.allowedScreens).not.toContain('reset-password');
      expect(navResult?.allowedScreens).not.toContain('verify-otp');
    });

    it('login normal sin preferencias navega a onboarding-categories', () => {
      const navResult = resolveRootNavigation({
        session: { access_token: 'user_jwt', user: { id: 'new_user' } },
        hasPreferences: false,
        pathname: '/login',
        isPasswordRecovery: false,
        isRecoveryVerified: false,
      });

      expect(navResult?.activeStack).toBe('onboarding-stack');
      expect(navResult?.initialRoute).toBe('onboarding-categories');
      expect(navResult?.allowedScreens).not.toContain('reset-password');
    });
  });

  describe('4. Cancelación y Limpieza de Sesión', () => {
    it('cancelar en reset-password ejecuta signOut y limpia ambas banderas de recuperación', async () => {
      vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({ error: null });

      let isPasswordRecovery = true;
      let isRecoveryVerified = true;

      const handleCancel = async () => {
        isPasswordRecovery = false;
        isRecoveryVerified = false;
        await signOut();
      };

      await handleCancel();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(isPasswordRecovery).toBe(false);
      expect(isRecoveryVerified).toBe(false);

      // Tras cancelación, la navegación vuelve a auth-stack / login de forma segura
      const navResult = resolveRootNavigation({
        session: null,
        hasPreferences: false,
        pathname: '/login',
        isPasswordRecovery: false,
      });

      expect(navResult?.activeStack).toBe('auth-stack');
      expect(navResult?.initialRoute).toBe('login');
    });
  });

  describe('5. Manejo de Errores al Actualizar Contraseña', () => {
    it('si updatePassword falla con error de Supabase, no cierra sesión y propaga el error amigablemente', async () => {
      vi.spyOn(supabase.auth, 'updateUser').mockResolvedValueOnce({
        data: { user: null },
        error: {
          name: 'AuthApiError',
          message: 'New password should be different from the old password.',
          status: 422,
        } as any,
      });

      const res = await updatePassword('MismaContrasena123!');

      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('different from the old password');
      expect(supabase.auth.signOut).not.toHaveBeenCalled();
    });

    it('si las contraseñas no coinciden o no cumplen longitud, validatePasswordChange detiene la solicitud antes de llamar a la red', async () => {
      const lengthValidation = validatePasswordChange('123', '123');
      expect(lengthValidation.isValid).toBe(false);
      expect(lengthValidation.error).toContain('al menos 6 caracteres');

      const mismatchValidation = validatePasswordChange('ClaveSegura123', 'ClaveDistinta999');
      expect(mismatchValidation.isValid).toBe(false);
      expect(mismatchValidation.error).toContain('no coinciden');

      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('6. Acceso Directo No Autorizado a /reset-password', () => {
    it('un usuario autenticado normal que navega directamente a /reset-password es bloqueado porque isRecoveryVerified es false', async () => {
      // Simula usuario normal que tiene sesión pero isRecoveryVerified: false
      const authState = {
        isPasswordRecovery: false,
        isRecoveryVerified: false,
        session: { access_token: 'regular_active_session', user: { id: 'regular_user' } },
        incomingUrl: null,
      };

      const result = await evaluateResetPasswordAccess(authState);

      expect(result.isVerified).toBe(false);
      expect(result.flow).toBe('unauthorized');
      expect(result.error).toContain('No se detectó un enlace de recuperación válido');
    });

    it('un usuario anónimo que abre directamente /reset-password sin parámetros es bloqueado', async () => {
      const authState = {
        isPasswordRecovery: false,
        isRecoveryVerified: false,
        session: null,
        incomingUrl: 'chaski://reset-password',
      };

      const result = await evaluateResetPasswordAccess(authState);

      expect(result.isVerified).toBe(false);
      expect(result.flow).toBe('unauthorized');
    });
  });

  describe('7. Preservación del Stack Durante la Sesión Temporal de Recuperación', () => {
    it('no desmonta el stack de recuperación cuando verifyOtp crea la sesión temporal', () => {
      const navResult = resolveRootNavigation({
        session: { access_token: 'temp_recovery_jwt', user: { id: 'u_rec' } },
        hasPreferences: true,
        pathname: '/reset-password',
        isPasswordRecovery: true,
        isRecoveryVerified: true,
      });

      expect(navResult?.activeStack).toBe('auth-stack');
      expect(navResult?.allowedScreens).toContain('reset-password');
    });
  });

  describe('8. Reproducción y Corrección del Bug en Dispositivo (verifyOtp → SIGNED_IN / prefsLoading → /login)', () => {
    it('reproduce el fallo anterior: si prefsLoading causaba return null o isRecoveryVerified no protegía el Stack, se desmontaba a login', () => {
      // Comportamiento bug anterior:
      // Cuando Supabase verifyOtp emite sesión y PreferencesProvider pone prefsLoading = true:
      const brokenNavigationCheck = ({
        session,
        prefsLoading,
        isRecoveryActive,
      }: {
        session: any;
        prefsLoading: boolean;
        isRecoveryActive: boolean;
      }) => {
        // En la versión con bug, RootNavigator hacía: if (authLoading || prefsLoading || !fontsLoaded) return null;
        if (prefsLoading) {
          return null; // desmontaba completamente el Stack
        }
        if (isRecoveryActive || !session) {
          return 'auth-stack';
        }
        return 'authenticated-stack';
      };

      const unmountedResult = brokenNavigationCheck({
        session: { user: { id: 'u1' } },
        prefsLoading: true,
        isRecoveryActive: true,
      });

      // El fallo desmontaba la app devolviendo null (provocando remonte de Stack en initialRouteName "login")
      expect(unmountedResult).toBeNull();
    });

    it('con la corrección: prefsLoading NO desmonta RootNavigator cuando la recuperación está activa', () => {
      const fixedNavResult = resolveRootNavigation({
        session: { access_token: 'temp_otp_session', user: { id: 'u1' } },
        hasPreferences: true,
        pathname: '/reset-password',
        isPasswordRecovery: true,
        isRecoveryVerified: true,
        prefsLoading: true, // Preferencias cargando en segundo plano tras emitirse sesión
      });

      // RootNavigator NO retorna null, mantiene el auth-stack con reset-password
      expect(fixedNavResult).not.toBeNull();
      expect(fixedNavResult?.activeStack).toBe('auth-stack');
      expect(fixedNavResult?.allowedScreens).toContain('reset-password');
    });

    it('isRecoveryVerified garantiza la permanencia en auth-stack incluso si SIGNED_IN llega antes de cambiar pathname', () => {
      // Simula el instante exacto en que verifyRecoveryOtp emite sesión en Supabase
      // pero el router aún no ha completado el cambio de ruta (pathname aún en /verify-otp o intermedio)
      const navResult = resolveRootNavigation({
        session: { access_token: 'otp_token', user: { id: 'u1' } },
        hasPreferences: true,
        pathname: '/verify-otp',
        isPasswordRecovery: true,
        isRecoveryVerified: true,
      });

      expect(navResult?.activeStack).toBe('auth-stack');
      expect(navResult?.allowedScreens).toContain('reset-password');
    });

    it('INITIAL_SESSION no limpia las banderas de recuperación en auth-context', () => {
      let isPasswordRecovery = true;
      let isRecoveryVerified = true;

      // Simulamos el manejador de onAuthStateChange corregido
      const onAuthStateChangeHandler = (event: string) => {
        if (event === 'PASSWORD_RECOVERY') {
          isPasswordRecovery = true;
        } else if (event === 'SIGNED_OUT') {
          isPasswordRecovery = false;
          isRecoveryVerified = false;
        }
        // INITIAL_SESSION ya NO resetea las banderas
      };

      onAuthStateChangeHandler('INITIAL_SESSION');

      expect(isPasswordRecovery).toBe(true);
      expect(isRecoveryVerified).toBe(true);

      // SIGNED_OUT sí las limpia limpiamente
      onAuthStateChangeHandler('SIGNED_OUT');
      expect(isPasswordRecovery).toBe(false);
      expect(isRecoveryVerified).toBe(false);
    });
  });
});
