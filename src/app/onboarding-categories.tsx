import { Redirect } from 'expo-router';
import { usePreferences } from '@/features/preferences/context/preferences-context';
import { PreferencesOnboardingScreen } from '@/features/preferences/screens';

export default function OnboardingCategoriesRoute() {
  const { hasPreferences } = usePreferences();

  if (hasPreferences) {
    return <Redirect href="/(tabs)" />;
  }

  return <PreferencesOnboardingScreen />;
}

