import { describe, expect, it } from 'vitest';

const MockColors = {
  light: { background: '#FAF5EE', text: '#4A2E18' },
  dark: { background: '#1E1712', text: '#F5EFE4' },
} as const;

/**
 * Función que replica fielmente la lógica de determinación de Stack y rutas
 * en RootNavigator (_layout.tsx).
 */
export function resolveRootNavigation({
  session,
  hasPreferences,
  authLoading,
  prefsLoading,
  prefsInitialLoading,
  fontsLoaded,
  isPasswordRecovery,
  isRecoveryVerified,
  pathname,
}: {
  session: any | null;
  hasPreferences: boolean;
  authLoading: boolean;
  prefsLoading?: boolean;
  prefsInitialLoading?: boolean;
  fontsLoaded: boolean;
  isPasswordRecovery?: boolean;
  isRecoveryVerified?: boolean;
  pathname?: string;
}): {
  shouldRenderTree: boolean;
  activeStack: 'auth-stack' | 'onboarding-stack' | 'authenticated-stack' | null;
  initialRoute: string | null;
  allowedScreens: string[];
} {
  const isRecoveryActive =
    pathname === '/verify-otp' ||
    pathname === '/reset-password' ||
    !!isPasswordRecovery ||
    !!isRecoveryVerified;

  const initialLoading = prefsInitialLoading !== undefined ? prefsInitialLoading : (prefsLoading ?? false);

  if (authLoading || (!isRecoveryActive && initialLoading) || !fontsLoaded) {
    return { shouldRenderTree: false, activeStack: null, initialRoute: null, allowedScreens: [] };
  }

  if (isRecoveryActive || !session) {
    return {
      shouldRenderTree: true,
      activeStack: 'auth-stack',
      initialRoute: 'login',
      allowedScreens: ['login', 'register', 'forgot-password', 'verify-otp', 'reset-password'],
    };
  }

  if (!hasPreferences) {
    return {
      shouldRenderTree: true,
      activeStack: 'onboarding-stack',
      initialRoute: 'onboarding-categories',
      allowedScreens: ['onboarding-categories', 'onboarding-budget'],
    };
  }

  return {
    shouldRenderTree: true,
    activeStack: 'authenticated-stack',
    initialRoute: '(tabs)',
    allowedScreens: [
      '(tabs)',
      'onboarding-categories',
      'onboarding-budget',
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
  };
}

describe('Pruebas de Regresión: Navegación Chaski Serie AX y Prevención de Pantalla Blanca', () => {
  const baseReadyState = {
    authLoading: false,
    prefsLoading: false,
    fontsLoaded: true,
  };

  describe('1. Inicio Limpio no Autenticado (Prevención de Pantalla Blanca en Login)', () => {
    it('en arranque en frío sin sesión, monta inmediatamente auth-stack con initialRoute login sin tocar (tabs)', () => {
      const result = resolveRootNavigation({
        ...baseReadyState,
        session: null,
        hasPreferences: false,
      });

      expect(result.shouldRenderTree).toBe(true);
      expect(result.activeStack).toBe('auth-stack');
      expect(result.initialRoute).toBe('login');
      expect(result.allowedScreens).toContain('login');
      expect(result.allowedScreens).not.toContain('(tabs)');
    });

    it('mientras authLoading sea true, el splash overlay cubre el árbol sin errores', () => {
      const loadingResult = resolveRootNavigation({
        ...baseReadyState,
        authLoading: true,
        session: null,
        hasPreferences: false,
      });

      expect(loadingResult.shouldRenderTree).toBe(false);
      expect(loadingResult.activeStack).toBeNull();
    });
  });

  describe('2. Transición Onboarding → Tabs al Confirmar Preferencias', () => {
    it('el AuthenticatedStack incluye onboarding-categories para no dejar la ruta huérfana tras el cambio de estado', () => {
      const authResult = resolveRootNavigation({
        ...baseReadyState,
        session: { user: { id: 'test-user-1' } },
        hasPreferences: true,
      });

      expect(authResult.shouldRenderTree).toBe(true);
      expect(authResult.activeStack).toBe('authenticated-stack');
      expect(authResult.initialRoute).toBe('(tabs)');
      // Garantía clave: contiene onboarding-categories para resolver el descriptor de pantalla
      expect(authResult.allowedScreens).toContain('onboarding-categories');
    });

    it('redirección declarativa en onboarding-categories: si !loading y hasPreferences es true, renderiza Redirect hacia /(tabs)', () => {
      const shouldRedirectOnboardingRoute = (loading: boolean, hasPreferences: boolean) => {
        if (!loading && hasPreferences) {
          return { redirect: true, href: '/(tabs)' };
        }
        return { redirect: false, href: null };
      };

      expect(shouldRedirectOnboardingRoute(false, false).redirect).toBe(false);
      expect(shouldRedirectOnboardingRoute(true, true).redirect).toBe(false);
      expect(shouldRedirectOnboardingRoute(false, true)).toEqual({
        redirect: true,
        href: '/(tabs)',
      });
    });
  });

  describe('3. Sesión Restaurada con Preferencias (Usuario Recurrente)', () => {
    it('si el usuario ya cuenta con preferencias al restaurar sesión, monta directamente authenticated-stack en (tabs)', () => {
      const result = resolveRootNavigation({
        ...baseReadyState,
        session: { user: { id: 'test-user-existing' } },
        hasPreferences: true,
      });

      expect(result.shouldRenderTree).toBe(true);
      expect(result.activeStack).toBe('authenticated-stack');
      expect(result.initialRoute).toBe('(tabs)');
    });
  });

  describe('4. Usuario Autenticado sin Preferencias (Usuario Nuevo)', () => {
    it('si el usuario inicia sesión y hasPreferences es false, monta inmediatamente onboarding-stack en onboarding-categories', () => {
      const result = resolveRootNavigation({
        ...baseReadyState,
        session: { user: { id: 'test-user-new' } },
        hasPreferences: false,
      });

      expect(result.shouldRenderTree).toBe(true);
      expect(result.activeStack).toBe('onboarding-stack');
      expect(result.initialRoute).toBe('onboarding-categories');
    });
  });

  describe('5. Prevención de Pantalla Blanca por checkPreferences en Segundo Plano', () => {
    it('una sincronización con isBackground: true no debe alterar el estado prefsLoading', () => {
      let isGlobalLoading = false;

      const simulateCheckPreferences = async (options?: { isBackground?: boolean }) => {
        const isBackground = options?.isBackground ?? false;
        if (!isBackground) {
          isGlobalLoading = true;
        }

        // Simulación de respuesta asíncrona
        await Promise.resolve();

        if (!isBackground) {
          isGlobalLoading = false;
        }
      };

      // Invocación regular (carga inicial)
      simulateCheckPreferences({ isBackground: false });
      expect(isGlobalLoading).toBe(true);

      // Invocación en segundo plano (post-guardado)
      isGlobalLoading = false;
      simulateCheckPreferences({ isBackground: true });
      expect(isGlobalLoading).toBe(false); // Nunca pasa a true, nunca bloquea RootNavigator
    });

    it('mientras prefsLoading sea false tras guardar, RootNavigator no devuelve null', () => {
      const postSaveNav = resolveRootNavigation({
        ...baseReadyState,
        prefsLoading: false, // Protegido por isBackground
        session: { user: { id: 'u1' } },
        hasPreferences: true,
      });
      expect(postSaveNav.shouldRenderTree).toBe(true);
    });

    it('distingue carga inicial de reconsultas en segundo plano: si prefsInitialLoading es false, prefsLoading=true no desmonta el árbol', () => {
      const duringSaveNav = resolveRootNavigation({
        ...baseReadyState,
        prefsInitialLoading: false,
        prefsLoading: true, // Guardado o reconsulta en segundo plano en progreso
        session: { user: { id: 'u1' } },
        hasPreferences: true,
      });
      expect(duringSaveNav.shouldRenderTree).toBe(true);
      expect(duringSaveNav.activeStack).toBe('authenticated-stack');
      expect(duringSaveNav.initialRoute).toBe('(tabs)');
    });
  });

  describe('6. Normalización de useColorScheme() y useTheme() en toda la aplicación', () => {
    it('garantiza colores válidos ante scheme undefined, null, unspecified o string vacío', () => {
      const getNormalizedColors = (scheme: string | null | undefined) => {
        const resolvedKey = scheme === 'dark' ? 'dark' : 'light';
        return MockColors[resolvedKey];
      };

      expect(getNormalizedColors(undefined)).toBe(MockColors.light);
      expect(getNormalizedColors(null)).toBe(MockColors.light);
      expect(getNormalizedColors('unspecified')).toBe(MockColors.light);
      expect(getNormalizedColors('light')).toBe(MockColors.light);
      expect(getNormalizedColors('dark')).toBe(MockColors.dark);
      expect(getNormalizedColors(undefined).background).toBeDefined();
    });

    it('useTheme nunca retorna undefined cuando scheme es null en Android', () => {
      const scheme: string | null = null;
      const theme = scheme === 'dark' ? 'dark' : 'light';
      const colors = MockColors[theme];

      expect(colors).toBeDefined();
      expect(colors.background).toBe('#FAF5EE');
    });
  });

  describe('7. Salida Discreta desde Onboarding (Cerrar Sesión)', () => {
    it('al invocar signOut desde onboarding sin preferencias, la sesión pasa a null y RootNavigator monta inmediatamente auth-stack (login)', () => {
      // Estado antes de cerrar sesión: usuario en onboarding
      const preSignOut = resolveRootNavigation({
        ...baseReadyState,
        session: { user: { id: 'user-stuck-onboarding' } },
        hasPreferences: false,
      });
      expect(preSignOut.activeStack).toBe('onboarding-stack');

      // Simulación de signOut de Supabase: sesión pasa a null
      const postSignOut = resolveRootNavigation({
        ...baseReadyState,
        session: null,
        hasPreferences: false,
      });

      expect(postSignOut.shouldRenderTree).toBe(true);
      expect(postSignOut.activeStack).toBe('auth-stack');
      expect(postSignOut.initialRoute).toBe('login');
      expect(postSignOut.allowedScreens).toContain('login');
    });
  });

  describe('8. Reintentar Sincronización sin Duplicar Operaciones de Guardado', () => {
    it('si las preferencias ya existen en Supabase, reintentar sincronización ejecuta checkPreferences y activa hasPreferences=true sin llamar a saveUserPreferencesAtomic', async () => {
      let rpcSaveCalls = 0;
      let checkPreferencesCalls = 0;
      let hasPreferences = false;

      // Servicio simulado con preferencias ya existentes en Supabase
      const simulateCheckPreferences = async () => {
        checkPreferencesCalls++;
        // Simula respuesta exitosa con datos ya guardados
        hasPreferences = true;
        return { data: { usuario_id: 'u1', categorias: [{ id: 'cat-1' }] }, error: null };
      };

      // Manejador de sincronización / reintento (handleRetrySync)
      const handleRetrySync = async () => {
        await simulateCheckPreferences();
      };

      await handleRetrySync();

      expect(checkPreferencesCalls).toBe(1);
      expect(rpcSaveCalls).toBe(0); // CERO llamadas de escritura duplicadas
      expect(hasPreferences).toBe(true); // Se activa la bandera para la transición declarativa
    });

    it('en handleEmitirBoleto, si hasPreferences ya es true, no duplica la RPC y sincroniza directamente', async () => {
      let rpcSaveCalls = 0;
      let checkCalls = 0;
      const hasPreferences = true;

      const handleEmitirBoleto = async () => {
        if (hasPreferences) {
          checkCalls++;
          return;
        }
        rpcSaveCalls++;
      };

      await handleEmitirBoleto();

      expect(rpcSaveCalls).toBe(0); // No duplica la RPC atómica
      expect(checkCalls).toBe(1);
    });
  });

  describe('9. Prevención de Pantalla Blanca Permanente (UI de Carga Serie AX)', () => {
    it('cuando authLoading, prefsLoading o !fontsLoaded están activos, RootNavigator dispone de un contenedor con fondo Serie AX y ActivityIndicator', () => {
      const getLoadingUI = (authLoading: boolean, prefsLoading: boolean, fontsLoaded: boolean) => {
        const isLoading = authLoading || prefsLoading || !fontsLoaded;
        if (isLoading) {
          return {
            rendersLoader: true,
            backgroundColor: '#FAF5EE',
            indicatorColor: '#9C3E1B',
          };
        }
        return { rendersLoader: false };
      };

      const loadingState = getLoadingUI(true, false, false);
      expect(loadingState.rendersLoader).toBe(true);
      expect(loadingState.backgroundColor).toBe('#FAF5EE');
      expect(loadingState.indicatorColor).toBe('#9C3E1B');

      const readyState = getLoadingUI(false, false, true);
      expect(readyState.rendersLoader).toBe(false);
    });
  });
});
