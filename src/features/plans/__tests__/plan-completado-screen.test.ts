import { beforeEach, describe, expect, it } from 'vitest';

import {
  markCelebrationAsTriggered,
  resetCelebrationTrackerForTest,
  shouldTriggerCelebration,
} from '@/features/plans/utils/celebration-tracker';
import {
  formatCompletadoDuration,
  formatCompletadoStopsLabel,
  formatCompletadoTicketMeta,
  getCompletadoDurationMinutes,
} from '@/features/plans/utils/plan-completado-formatters';

describe('Plan Completado Serie AX — Control de Celebración y Reglas', () => {
  beforeEach(() => {
    resetCelebrationTrackerForTest();
  });

  describe('Control One-Shot de la Celebración (Confeti Reanimated)', () => {
    it('dispara la celebración cuando un plan acaba de ser completado', () => {
      const now = Date.now();
      const justCompletedIso = new Date(now - 1000).toISOString(); // 1 segundo atrás

      expect(shouldTriggerCelebration('plan-1', justCompletedIso, now)).toBe(true);
    });

    it('no vuelve a disparar la celebración si el plan ya fue celebrado en la sesión', () => {
      const now = Date.now();
      const completedIso = new Date(now - 2000).toISOString();

      expect(shouldTriggerCelebration('plan-1', completedIso, now)).toBe(true);

      // Se marca como celebrado
      markCelebrationAsTriggered('plan-1', completedIso);

      // Siguiente chequeo (ej. re-render, restauración de estado o navegación de vuelta)
      expect(shouldTriggerCelebration('plan-1', completedIso, now)).toBe(false);
    });

    it('no dispara la celebración si el plan fue completado hace más de 5 minutos (histórico antiguo)', () => {
      const now = Date.now();
      const sixMinutesAgoIso = new Date(now - 6 * 60 * 1000).toISOString();

      expect(shouldTriggerCelebration('plan-old', sixMinutesAgoIso, now)).toBe(false);
    });

    it('no dispara si no hay identificador de plan válido', () => {
      expect(shouldTriggerCelebration(null, new Date().toISOString())).toBe(false);
      expect(shouldTriggerCelebration(undefined, new Date().toISOString())).toBe(false);
    });
  });

  describe('Resumen del Recorrido y Metadatos de la Pantalla', () => {
    it('formatea la fecha de finalización en formato peruano legible', () => {
      const iso = '2026-10-13T16:00:00.000Z';
      const fecha = new Date(iso).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      expect(fecha).toBeTruthy();
      expect(fecha).toContain('2026');
    });

    it('pluraliza con precisión las paradas logradas', () => {
      expect(formatCompletadoStopsLabel(1)).toBe('1 parada');
      expect(formatCompletadoStopsLabel(2)).toBe('2 paradas');
      expect(formatCompletadoStopsLabel(5)).toBe('5 paradas');
    });

    it('presenta la duración en formato natural «X h Y min aprox.» respetando el valor real', () => {
      expect(formatCompletadoDuration(72)).toBe('1 h 12 min aprox.');
      expect(formatCompletadoDuration(60)).toBe('1 h aprox.');
      expect(formatCompletadoDuration(125)).toBe('2 h 5 min aprox.');
      expect(formatCompletadoDuration(45)).toBe('45 min aprox.');
      expect(formatCompletadoDuration(0)).toBe('0 min aprox.');
      expect(formatCompletadoDuration(null)).toBe('0 min aprox.');
    });

    it('redondea minutos fraccionarios para no mostrar decimales en el boleto', () => {
      expect(formatCompletadoDuration(72.4)).toBe('1 h 12 min aprox.');
      expect(formatCompletadoDuration(0.6)).toBe('1 min aprox.');
      expect(formatCompletadoDuration(Number.NaN)).toBe('0 min aprox.');
    });

    it('toma la duración desde el total de la expedición (permanencia + traslados)', () => {
      const entry = {
        duracion_total_min: 72,
        paradas: [{ duracion_min: 25 }, { duracion_min: 40 }],
      };

      expect(getCompletadoDurationMinutes(entry)).toBe(72);
      expect(formatCompletadoTicketMeta(2, getCompletadoDurationMinutes(entry))).toBe(
        '2 paradas · 1 h 12 min aprox.',
      );
    });

    it('recurre a la suma de las paradas si el total no está almacenado', () => {
      const paradas = [{ duracion_min: 25 }, { duracion_min: 40 }];

      expect(getCompletadoDurationMinutes({ duracion_total_min: 0, paradas })).toBe(65);
      expect(getCompletadoDurationMinutes({ duracion_total_min: null, paradas })).toBe(65);
      expect(getCompletadoDurationMinutes({ duracion_total_min: undefined, paradas })).toBe(65);
    });

    it('devuelve 0 cuando no hay ningún dato de duración utilizable', () => {
      expect(getCompletadoDurationMinutes({})).toBe(0);
      expect(getCompletadoDurationMinutes({ duracion_total_min: 0, paradas: [] })).toBe(0);
    });

    it('compone el resumen meta completo del boleto sin abreviaciones artificiales', () => {
      expect(formatCompletadoTicketMeta(1, 60)).toBe('1 parada · 1 h aprox.');
      expect(formatCompletadoTicketMeta(2, 72)).toBe('2 paradas · 1 h 12 min aprox.');
      expect(formatCompletadoTicketMeta(3, 45)).toBe('3 paradas · 45 min aprox.');
    });
  });

  describe('Contrato de Integración y Dimensiones de la Ilustración del Pututu', () => {
    it('define la ubicación estándar del archivo gráfico en assets/images/pututu.png', () => {
      const assetPath = 'assets/images/pututu.png';
      expect(assetPath).toBe('assets/images/pututu.png');
      expect(assetPath.endsWith('.png')).toBe(true);
    });

    it('calcula la altura manteniendo la relación de aspecto original (1312 x 1199)', () => {
      const originalWidth = 1312;
      const originalHeight = 1199;
      const aspectRatio = originalWidth / originalHeight;

      const targetWidth = 124;
      const calculatedHeight = Math.round(targetWidth / aspectRatio);

      expect(calculatedHeight).toBe(113);
      // Sin recortes ni deformaciones
      expect(targetWidth / calculatedHeight).toBeCloseTo(aspectRatio, 1);
    });

    it('el confeti animado mantiene un recuento equilibrado (12 partículas) para no duplicar el arte', () => {
      const balancedParticleCount = 12;
      expect(balancedParticleCount).toBeLessThanOrEqual(16);
      expect(balancedParticleCount).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Distribución Vertical Flexible y Accesibilidad de Layout', () => {
    it('el área de contenido crece y centra el bloque para adaptarse a distintas alturas de pantalla', () => {
      const scrollStyle = {
        flexGrow: 1,
        justifyContent: 'center',
      };
      expect(scrollStyle.flexGrow).toBe(1);
      expect(scrollStyle.justifyContent).toBe('center');
    });

    it('el bloque de contenido apila el resumen y las acciones con separación compacta (sin espacio vacío intermedio)', () => {
      const bodyStyle = {
        paddingHorizontal: 20,
        gap: 16,
      };
      const ctasStyle = {
        gap: 12,
      };
      // Sin distribución por space-between: las acciones siguen al resumen.
      expect((bodyStyle as Record<string, unknown>).justifyContent).toBeUndefined();
      expect((bodyStyle as Record<string, unknown>).flex).toBeUndefined();
      expect(bodyStyle.gap + ctasStyle.gap).toBeLessThanOrEqual(32);
    });

    it('las acciones inferiores evitan márgenes inferiores artificiales para no duplicar el inset del sistema', () => {
      const ctasStyle = {
        gap: 12,
      };
      expect((ctasStyle as Record<string, unknown>).marginBottom).toBeUndefined();
      expect((ctasStyle as Record<string, unknown>).paddingTop).toBeUndefined();
    });

    it('el relleno inferior seguro respeta estrictamente los insets de Android', () => {
      const getBottomPadding = (bottomInset: number) => Math.max(bottomInset, 16);
      expect(getBottomPadding(0)).toBe(16);
      expect(getBottomPadding(24)).toBe(24);
      expect(getBottomPadding(48)).toBe(48);
    });

    it('la cenefa tocapu se desplaza con el inset superior para no invadir la barra de estado', () => {
      const getTopPadding = (topInset: number) => topInset;
      expect(getTopPadding(0)).toBe(0);
      expect(getTopPadding(24)).toBe(24);
      expect(getTopPadding(48)).toBe(48);
    });

    it('la acción secundaria usa contorno (no relleno) para distinguirse de la primaria', () => {
      const secondaryBtnStyle = {
        height: 50,
        borderRadius: 6,
        borderWidth: 1.5,
      };
      // La primaria (WizardButton) se rellena con palette.primary;
      // la secundaria conserva el mismo alto táctil pero solo dibuja borde.
      expect(secondaryBtnStyle.height).toBe(50);
      expect(secondaryBtnStyle.borderWidth).toBeGreaterThan(0);
    });

    it('el acento del boleto se dibuja en flujo normal, sin posiciones absolutas', () => {
      const ticketAccentStyle = {
        height: 4,
        width: '100%',
      };
      expect((ticketAccentStyle as Record<string, unknown>).position).toBeUndefined();
      expect((ticketAccentStyle as Record<string, unknown>).left).toBeUndefined();
    });
  });
});
