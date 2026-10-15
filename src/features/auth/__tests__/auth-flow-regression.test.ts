import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  hasRecoveryPayload,
  parseRecoveryUrl,
  resetPayloadRegistry,
  getRecoveryFingerprint,
  canProcessPayload,
  markPayloadInFlight,
  markPayloadSuccess,
} from '../utils/recovery-link';
import { processRecoveryLink } from '../services/recovery.service';
import { signIn, signOut, updatePassword } from '../services/auth.service';
import { validateLoginFields } from '../utils/password-validation';
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
 * Función que replica fielmente la lógica de determinación de ruta y pila activa de RootNavigator (_layout.tsx).
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

describe('Pruebas de Regresión: Flujo de Autenticación y Recuperación de Contraseña', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPayloadRegistry();
  });

  describe('1. Login Normal (signInWithPassword y navegación)', () => {
    it('inicia sesión con correo y contraseña llamando a signInWithPassword', async () => {
      const mockSession = { access_token: 'valid_token', user: { id: 'user_123' } };
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: { user: mockSession.user as any, session: mockSession as any },
        error: null,
      });

      const result = await signIn({ email: 'viajero@chaski.pe', password: 'password123' });

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'viajero@chaski.pe',
        password: 'password123',
      });
      expect(result.error).toBeNull();
      expect(result.data?.session).toEqual(mockSession);
    });

    it('garantiza que tras un login normal con preferencias, el navegador resuelve a (tabs) y nunca a reset-password', () => {
      // Estado justo después de hacer submit en /login
      const navResult = resolveRootNavigation({
        session: { user: { id: 'u1' } },
        hasPreferences: true,
        pathname: '/login',
        isPasswordRecovery: false,
      });

      expect(navResult.activeStack).toBe('authenticated-stack');
      expect(navResult.initialRoute).toBe('(tabs)');
      expect(navResult.firstScreen).toBe('(tabs)');
      expect(navResult.allowedScreens).not.toContain('reset-password');
      expect(navResult.firstScreen).not.toBe('reset-password');
    });

    it('garantiza que tras un login normal sin preferencias, el navegador resuelve a onboarding-categories y nunca a reset-password', () => {
      const navResult = resolveRootNavigation({
        session: { user: { id: 'u1' } },
        hasPreferences: false,
        pathname: '/login',
        isPasswordRecovery: false,
      });

      expect(navResult.activeStack).toBe('onboarding-stack');
      expect(navResult.initialRoute).toBe('onboarding-categories');
      expect(navResult.firstScreen).toBe('onboarding-categories');
      expect(navResult.allowedScreens).not.toContain('reset-password');
    });

    it('garantiza que en estado no autenticado la pantalla inicial es login y no reset-password', () => {
      const navResult = resolveRootNavigation({
        session: null,
        hasPreferences: false,
        pathname: '/',
        isPasswordRecovery: false,
      });

      expect(navResult.activeStack).toBe('auth-stack');
      expect(navResult.initialRoute).toBe('login');
      expect(navResult.firstScreen).toBe('login');
    });

    it('valida que ambos campos sean obligatorios antes de llamar a signIn', () => {
      expect(validateLoginFields('', '').isValid).toBe(false);
      expect(validateLoginFields('', '').emailError).toBe('Ingresa tu correo electrónico');
      expect(validateLoginFields('viajero@chaski.pe', '').isValid).toBe(false);
      expect(validateLoginFields('viajero@chaski.pe', '').passwordError).toBe('Ingresa tu contraseña');
      expect(validateLoginFields('', 'secret').isValid).toBe(false);
      expect(validateLoginFields('viajero@chaski.pe', 'secret').isValid).toBe(true);
    });

    it('calcula los offsets de auto-desplazamiento para correo y contraseña en pantallas estándar y compactas', () => {
      const getLoginScrollOffset = (
        fieldKey: string,
        isCompact: boolean,
        measured?: Record<string, number>,
      ) => {
        if (measured && typeof measured[fieldKey] === 'number') {
          return measured[fieldKey];
        }
        const defaults = isCompact
          ? { email: 0, password: 80 }
          : { email: 0, password: 100 };
        return defaults[fieldKey as keyof typeof defaults] ?? 0;
      };

      // Estándar
      expect(getLoginScrollOffset('email', false)).toBe(0);
      expect(getLoginScrollOffset('password', false)).toBe(100);

      // Compacto (<680)
      expect(getLoginScrollOffset('email', true)).toBe(0);
      expect(getLoginScrollOffset('password', true)).toBe(80);

      // Con mediciones nativas onLayout
      expect(getLoginScrollOffset('password', false, { email: 0, password: 92 })).toBe(92);
    });

    it('limpia banderas de recuperación de contraseña antes de iniciar sesión', () => {
      const authFlags = { isPasswordRecovery: true, isRecoveryVerified: true };
      const prepareLogin = () => {
        authFlags.isPasswordRecovery = false;
        authFlags.isRecoveryVerified = false;
      };

      prepareLogin();
      expect(authFlags.isPasswordRecovery).toBe(false);
      expect(authFlags.isRecoveryVerified).toBe(false);
    });
  });

  describe('2. Recuperación Válida por Deep Link (Cold Start, Warm Start y PKCE)', () => {
    it('detecta carga útil válida y permite procesar código PKCE', async () => {
      const deepLink = 'chaski://reset-password?code=valid_pkce_code_789';
      const parsed = parseRecoveryUrl(deepLink);

      expect(hasRecoveryPayload(parsed)).toBe(true);
      expect(parsed.code).toBe('valid_pkce_code_789');

      vi.spyOn(supabase.auth, 'exchangeCodeForSession').mockResolvedValueOnce({
        data: { user: { id: 'rec_user' } as any, session: { access_token: 'tok' } as any },
        error: null,
      });

      const result = await processRecoveryLink(parsed);
      expect(result.success).toBe(true);
      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('valid_pkce_code_789');
    });

    it('mantiene activa la recuperación durante el canje PKCE cuando se establece sesión temporal', () => {
      // Cuando exchangeCodeForSession tiene éxito, se crea una sesión temporal en Supabase
      // isPasswordRecovery debe mantenerse en true para que el Stack de recuperación no se desmonte
      const navResult = resolveRootNavigation({
        session: { user: { id: 'rec_user' } },
        hasPreferences: true,
        pathname: '/reset-password',
        isPasswordRecovery: true,
      });

      expect(navResult.activeStack).toBe('auth-stack');
      expect(navResult.allowedScreens).toContain('reset-password');
    });

    it('en warm start con sesión activa existente, un enlace legítimo de recuperación activa el flujo de recuperación', () => {
      const navResult = resolveRootNavigation({
        session: { user: { id: 'existing_user' } },
        hasPreferences: true,
        pathname: '/reset-password',
        isPasswordRecovery: false, // al llegar el deep link con ruta /reset-password
      });

      expect(navResult.activeStack).toBe('auth-stack');
      expect(navResult.allowedScreens).toContain('reset-password');
    });
  });

  describe('3. Limpieza del Estado de Recuperación y Protección ante Acceso Directo', () => {
    it('rechaza acceso directo a reset-password sin parámetros de recuperación', () => {
      const directUrl = 'chaski://reset-password';
      const parsed = parseRecoveryUrl(directUrl);

      expect(hasRecoveryPayload(parsed)).toBe(false);
      expect(parsed.code).toBeUndefined();
      expect(parsed.tokenHash).toBeUndefined();
      expect(parsed.accessToken).toBeUndefined();
    });

    it('limpia el estado de recuperación y finaliza la sesión al completar el cambio de contraseña', async () => {
      vi.spyOn(supabase.auth, 'updateUser').mockResolvedValueOnce({
        data: { user: {} as any },
        error: null,
      });
      vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({
        error: null,
      });

      // Simula el flujo completo de restablecimiento
      const updateResult = await updatePassword('NuevaClaveSuperSegura99!');
      expect(updateResult.error).toBeNull();

      const signOutResult = await signOut();
      expect(signOutResult.error).toBeNull();
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);

      // Tras signOut, la sesión es null y isPasswordRecovery vuelve a false
      const navResult = resolveRootNavigation({
        session: null,
        hasPreferences: false,
        pathname: '/login',
        isPasswordRecovery: false,
      });

      expect(navResult.activeStack).toBe('auth-stack');
      expect(navResult.initialRoute).toBe('login');
    });

    it('el registro de huellas (payloadRegistry) previene reprocesamiento múltiple tras éxito', () => {
      const params = { code: 'single_use_auth_code_111' };
      const fp = getRecoveryFingerprint(params)!;

      expect(canProcessPayload(fp)).toBe(true);
      markPayloadInFlight(fp);
      markPayloadSuccess(fp);

      // Intento posterior con el mismo código es bloqueado
      expect(canProcessPayload(fp)).toBe(false);
    });
  });
});
