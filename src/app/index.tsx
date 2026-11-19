import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/context/auth-context';
import { usePreferences } from '@/features/preferences/context/preferences-context';

export default function Index() {
  const { session } = useAuth();
  const { hasPreferences } = usePreferences();

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!hasPreferences) {
    return <Redirect href="/onboarding-categories" />;
  }

  return <Redirect href="/(tabs)" />;
}
