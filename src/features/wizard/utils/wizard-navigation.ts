import { router, type Href } from 'expo-router';

export interface WizardNavigationTarget {
  replace: (href: Href) => void;
  back: () => void;
  canGoBack: () => boolean;
  dismissAll?: () => void;
}

/**
 * Cierre seguro del wizard Serie AX:
 * Regresa a Inicio (tabs) de forma determinista con replace,
 * evitando errores 'The action GO_BACK was not handled by any navigator'
 * causados por llamar a router.dismissAll() o router.back() cuando
 * no existe historial previo en el stack.
 */
export function safeCancelWizard(nav?: WizardNavigationTarget | unknown): void {
  const target: WizardNavigationTarget =
    nav && typeof (nav as any).replace === 'function'
      ? (nav as WizardNavigationTarget)
      : router;
  target.replace('/(tabs)');
}

/**
 * Retorno seguro al paso anterior del wizard.
 * Si canGoBack() es verdadero, retrocede con back();
 * de lo contrario, navega con replace hacia la ruta fallback
 * para prevenir excepciones no controladas.
 */
export function safeBackWizard(
  fallbackRoute: Href = '/(tabs)',
  nav?: WizardNavigationTarget | unknown,
): void {
  // Si fallbackRoute fue recibido como un evento táctil (GestureResponderEvent), normalizar
  const route: Href =
    typeof fallbackRoute === 'string' ||
    (fallbackRoute && typeof fallbackRoute === 'object' && 'pathname' in (fallbackRoute as any))
      ? fallbackRoute
      : '/(tabs)';

  const target: WizardNavigationTarget =
    nav && typeof (nav as any).canGoBack === 'function' && typeof (nav as any).back === 'function'
      ? (nav as WizardNavigationTarget)
      : fallbackRoute &&
        typeof (fallbackRoute as any).canGoBack === 'function' &&
        typeof (fallbackRoute as any).back === 'function'
      ? (fallbackRoute as any as WizardNavigationTarget)
      : router;

  if (target.canGoBack()) {
    target.back();
  } else {
    target.replace(route);
  }
}
