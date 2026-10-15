import { Redirect } from 'expo-router';

/**
 * Ruta de onboarding obsoleta.
 * Redirige automáticamente a la pantalla de onboarding unificado.
 */
export default function LegacyOnboardingBudget() {
  return <Redirect href="/onboarding-categories" />;
}

