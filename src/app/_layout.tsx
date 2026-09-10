import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/features/auth/context/auth-context';
import { PreferencesProvider, usePreferences } from '@/features/preferences/context/preferences-context';
import { WizardProvider } from '@/features/wizard/context/wizard-context';
import { PlansProvider } from '@/features/plans/context/plans-context';
import { useAppFonts } from '@/hooks/use-app-fonts';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { session, loading: authLoading } = useAuth();
  const { loading: prefsLoading, hasPreferences } = usePreferences();
  const fontsLoaded = useAppFonts();

  if (authLoading || prefsLoading || !fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {!session ? (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack>
      ) : !hasPreferences ? (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding-categories" />
          <Stack.Screen name="onboarding-budget" />
        </Stack>
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="preferences" />
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
        </Stack>
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
