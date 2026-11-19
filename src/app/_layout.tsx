import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors, Fonts } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth/context/auth-context';
import { PreferencesProvider, usePreferences } from '@/features/preferences/context/preferences-context';
import { WizardProvider } from '@/features/wizard/context/wizard-context';
import { PlansProvider } from '@/features/plans/context/plans-context';
import { registerPdfNotificationListener } from '@/features/admin/services/admin-pdf-notification.service';
import { useAppFonts } from '@/hooks/use-app-fonts';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: 'index',
};

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { session, loading: authLoading, isPasswordRecovery, isRecoveryVerified } = useAuth();
  const { initialLoading: prefsInitialLoading, hasPreferences } = usePreferences();
  const fontsLoaded = useAppFonts();
  const pathname = usePathname();

  const isRecoveryActive =
    pathname === '/verify-otp' ||
    pathname === '/reset-password' ||
    isPasswordRecovery ||
    isRecoveryVerified;

  const isLoading = authLoading || (!isRecoveryActive && prefsInitialLoading) || !fontsLoaded;

  const isUnauthenticated = !session || isRecoveryActive;
  const isNeedsOnboarding = Boolean(session && !hasPreferences && !isRecoveryActive);
  const isAuthenticated = Boolean(session && hasPreferences && !isRecoveryActive);

  useEffect(() => {
    const unsubscribe = registerPdfNotificationListener();
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Ruta raíz para despachar según estado de autenticación */}
        <Stack.Screen name="index" />

        {/* Rutas de autenticación y recuperación */}
        <Stack.Protected guard={isUnauthenticated} redirectTo="/(tabs)">
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="verify-otp" />
          <Stack.Screen name="reset-password" />
        </Stack.Protected>

        {/* Rutas de onboarding para usuarios autenticados sin preferencias */}
        <Stack.Protected guard={isNeedsOnboarding} redirectTo="/login">
          <Stack.Screen name="onboarding-categories" />
          <Stack.Screen name="onboarding-budget" />
        </Stack.Protected>

        {/* Rutas principales para usuarios autenticados con preferencias */}
        <Stack.Protected guard={isAuthenticated} redirectTo="/login">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="preferences" />
          <Stack.Screen name="change-password" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="admin/planes" />
          <Stack.Screen name="admin/lugares" />
          <Stack.Screen name="admin/auditoria" />
          <Stack.Screen name="admin/reportes" />
          <Stack.Screen name="places" />
          <Stack.Screen name="place/[id]" />
          <Stack.Screen name="wizard/ubicacion" />
          <Stack.Screen name="wizard/mapa" />
          <Stack.Screen name="wizard/tiempo" />
          <Stack.Screen name="wizard/presupuesto" />
          <Stack.Screen name="wizard/intereses" />
          <Stack.Screen name="wizard/movilidad" />
          <Stack.Screen name="plan/buscando" />
          <Stack.Screen name="plan/resultados" />
          <Stack.Screen name="plan/detalle" />
          <Stack.Screen name="plan/activo" />
          <Stack.Screen name="plan/completado" />
        </Stack.Protected>
      </Stack>

      {isLoading && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: Colors.light.background,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 32,
              zIndex: 999,
            },
          ]}
        >
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text
            style={{
              fontFamily: Fonts.serif,
              fontSize: 18,
              fontWeight: '700',
              color: Colors.light.brand,
              marginTop: 18,
              letterSpacing: 1.2,
            }}
          >
            CHASKI
          </Text>
          <Text
            style={{
              fontFamily: Fonts.mono,
              fontSize: 9.5,
              fontWeight: '700',
              color: Colors.light.primary,
              letterSpacing: 1.5,
              marginTop: 4,
            }}
          >
            SERIE AX · EXPEDICIONES CULTURALES
          </Text>
          <Text
            style={{
              fontFamily: Fonts.sans,
              fontSize: 11.5,
              color: Colors.light.textSecondary,
              textAlign: 'center',
              marginTop: 22,
              lineHeight: 17,
              fontStyle: 'italic',
            }}
          >
            «Cuenta la historia que Chaski fue pensado por Katherine mientras disfrutaba de unas papas fritas.»
          </Text>
        </View>
      )}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <WizardProvider>
          <PlansProvider>
            <RootNavigator />
          </PlansProvider>
        </WizardProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}
