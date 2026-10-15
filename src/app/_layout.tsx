import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, View, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth/context/auth-context';
import { PreferencesProvider, usePreferences } from '@/features/preferences/context/preferences-context';
import { WizardProvider } from '@/features/wizard/context/wizard-context';
import { PlansProvider } from '@/features/plans/context/plans-context';
import { useAppFonts } from '@/hooks/use-app-fonts';

SplashScreen.preventAutoHideAsync();

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

  if (authLoading || (!isRecoveryActive && prefsInitialLoading) || !fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.light.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {isRecoveryActive || !session ? (
        <Stack screenOptions={{ headerShown: false }} initialRouteName="login">
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="verify-otp" />
          <Stack.Screen name="reset-password" />
        </Stack>
      ) : !hasPreferences ? (
        <Stack screenOptions={{ headerShown: false }} initialRouteName="onboarding-categories">
          <Stack.Screen name="onboarding-categories" />
          <Stack.Screen name="onboarding-budget" />
        </Stack>
      ) : (
        <Stack screenOptions={{ headerShown: false }} initialRouteName="(tabs)">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding-categories" />
          <Stack.Screen name="onboarding-budget" />
          <Stack.Screen name="preferences" />
          <Stack.Screen name="change-password" />
          <Stack.Screen name="admin" />
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
