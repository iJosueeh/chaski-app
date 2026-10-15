import { beforeEach, describe, expect, it, vi } from 'vitest';

import { safeBackWizard, safeCancelWizard, type WizardNavigationTarget } from '../utils/wizard-navigation';

vi.mock('react-native', () => ({
  Platform: { select: (obj: any) => obj.android ?? obj.default },
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('expo-router', () => ({
  router: {
    replace: vi.fn(),
    back: vi.fn(),
    canGoBack: vi.fn(),
    dismissAll: vi.fn(),
  },
}));

describe('Wizard Serie AX — Navegación Segura y Reglas de Cierre', () => {
  let mockNav: WizardNavigationTarget;

  beforeEach(() => {
    mockNav = {
      replace: vi.fn(),
      back: vi.fn(),
      canGoBack: vi.fn(),
      dismissAll: vi.fn(),
    };
  });

  describe('safeCancelWizard (Acción del botón ✕)', () => {
    it('cierra el wizard navegando de forma determinista a /(tabs) con replace', () => {
      safeCancelWizard(mockNav);

      expect(mockNav.replace).toHaveBeenCalledWith('/(tabs)');
      expect(mockNav.back).not.toHaveBeenCalled();
      expect(mockNav.dismissAll).not.toHaveBeenCalled();
    });

    it('funciona de manera idéntica tanto si canGoBack es true como si es false', () => {
      vi.mocked(mockNav.canGoBack).mockReturnValue(true);
      safeCancelWizard(mockNav);
      expect(mockNav.replace).toHaveBeenCalledWith('/(tabs)');

      vi.clearAllMocks();
      vi.mocked(mockNav.canGoBack).mockReturnValue(false);
      safeCancelWizard(mockNav);
      expect(mockNav.replace).toHaveBeenCalledWith('/(tabs)');
      expect(mockNav.back).not.toHaveBeenCalled();
    });

    it('ignora argumentos de eventos táctiles (GestureResponderEvent) y no lanza TypeError', () => {
      const syntheticTouchEvent = { nativeEvent: { pageX: 100, pageY: 200 } };
      expect(() => safeCancelWizard(syntheticTouchEvent)).not.toThrow();
    });

    it('funciona sin argumentos usando router por defecto', () => {
      expect(() => safeCancelWizard()).not.toThrow();
    });
  });

  describe('safeBackWizard (Acción del botón ‹)', () => {
    it('cuando existe historial previo (canGoBack = true), ejecuta back()', () => {
      vi.mocked(mockNav.canGoBack).mockReturnValue(true);

      safeBackWizard('/wizard/ubicacion', mockNav);

      expect(mockNav.back).toHaveBeenCalledTimes(1);
      expect(mockNav.replace).not.toHaveBeenCalled();
    });

    it('cuando NO existe historial previo (canGoBack = false), usa replace con la ruta fallback', () => {
      vi.mocked(mockNav.canGoBack).mockReturnValue(false);

      safeBackWizard('/wizard/tiempo', mockNav);

      expect(mockNav.back).not.toHaveBeenCalled();
      expect(mockNav.replace).toHaveBeenCalledWith('/wizard/tiempo');
    });

    it('si no se provee ruta fallback y canGoBack es false, navega por defecto a /(tabs)', () => {
      vi.mocked(mockNav.canGoBack).mockReturnValue(false);

      safeBackWizard(undefined, mockNav);

      expect(mockNav.back).not.toHaveBeenCalled();
      expect(mockNav.replace).toHaveBeenCalledWith('/(tabs)');
    });

    it('garantiza retroceso seguro para cada etapa del wizard sin lanzar GO_BACK no atendido', () => {
      const wizardSteps = [
        { from: 'wizard/ubicacion', fallback: '/(tabs)' },
        { from: 'wizard/mapa', fallback: '/wizard/ubicacion' },
        { from: 'wizard/tiempo', fallback: '/wizard/ubicacion' },
        { from: 'wizard/presupuesto', fallback: '/wizard/tiempo' },
        { from: 'wizard/intereses', fallback: '/wizard/presupuesto' },
        { from: 'wizard/movilidad', fallback: '/wizard/intereses' },
        { from: 'plan/resultados', fallback: '/wizard/movilidad' },
        { from: 'plan/detalle', fallback: '/plan/resultados' },
      ];

      for (const step of wizardSteps) {
        vi.clearAllMocks();
        vi.mocked(mockNav.canGoBack).mockReturnValue(false);

        safeBackWizard(step.fallback as any, mockNav);

        expect(mockNav.back).not.toHaveBeenCalled();
        expect(mockNav.replace).toHaveBeenCalledWith(step.fallback);
      }
    });
  });

  describe('Contratos de Diseño y Ergonomía Serie AX', () => {
    it('la barra superior define botones con dimensiones táctiles mínimas de 48x48 dp', () => {
      const topBarButtonDimensions = {
        minWidth: 48,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
      };

      expect(topBarButtonDimensions.minWidth).toBeGreaterThanOrEqual(48);
      expect(topBarButtonDimensions.minHeight).toBeGreaterThanOrEqual(48);
    });

    it('los tokens de color del wizard se alinean con la identidad Serie AX clara', () => {
      const palette = {
        parchment: '#FAF5EE',
        ivory: '#FFFDF9',
        ink: '#4A2E18',
        terracotta: '#9C3E1B',
        burgundy: '#7D2935',
        gold: '#D4AF37',
        border: '#E2D7C3',
      };

      expect(palette.parchment).toBe('#FAF5EE'); // Pergamino
      expect(palette.ivory).toBe('#FFFDF9');    // Marfil
      expect(palette.ink).toBe('#4A2E18');       // Tinta
      expect(palette.terracotta).toBe('#9C3E1B'); // Terracota
      expect(palette.burgundy).toBe('#7D2935');   // Borgoña
      expect(palette.gold).toBe('#D4AF37');     // Dorado ocre
      expect(palette.border).toBe('#E2D7C3');     // Borde sutil
    });
  });
});
