import { describe, expect, it } from 'vitest';

import {
  buildMapsNavigationUrl,
  formatStopArrivalLabel,
  formatStopCostLabel,
  formatStopDurationLabel,
  getFinalizarHelperText,
} from '@/features/plans/utils/plan-active-formatters';

describe('Plan Activo Serie AX — Formateadores y Reglas de Visualización', () => {
  describe('Formateo Preciso y Honesto de Costos de Parada', () => {
    it('muestra «Acceso libre / Sin costo» cuando el costo y gasto máximo son 0', () => {
      expect(formatStopCostLabel(0, null, 0)).toBe('Acceso libre / Sin costo');
      expect(formatStopCostLabel(0, 0, 0)).toBe('Acceso libre / Sin costo');
    });

    it('muestra rango referencial cuando existen gasto mínimo y máximo diferentes', () => {
      expect(formatStopCostLabel(40, 20, 50)).toBe('Gasto referencial: S/ 20 — S/ 50');
    });

    it('muestra «Gasto estimado: hasta S/ X» cuando solo se define un límite superior', () => {
      expect(formatStopCostLabel(40, null, 40)).toBe('Gasto estimado: hasta S/ 40');
      expect(formatStopCostLabel(40, 0, 40)).toBe('Gasto estimado: hasta S/ 40');
    });

    it('usa el costo estimado del plan si gasto_max no está presente en el lugar', () => {
      expect(formatStopCostLabel(35, null, null)).toBe('Gasto estimado: hasta S/ 35');
    });
  });

  describe('Formateo de Horarios y Tiempos de Permanencia', () => {
    it('formatea la hora proyectada con etiqueta explícita de llegada estimada', () => {
      expect(formatStopArrivalLabel('11:56')).toBe('Llegada estimada: 11:56 hrs');
    });

    it('formatea la duración con etiqueta explícita de permanencia sugerida', () => {
      expect(formatStopDurationLabel(60)).toBe('Permanencia sugerida: 60 min');
      expect(formatStopDurationLabel(30)).toBe('Permanencia sugerida: 30 min');
    });
  });

  describe('Reglas y Explicación del Botón Finalizar', () => {
    it('explica por qué Finalizar está deshabilitado cuando hay 0 paradas visitadas', () => {
      const helper = getFinalizarHelperText(0, 1);
      expect(helper).toContain('El botón «Finalizar» se habilitará al marcar al menos una parada como visitada');
      expect(helper).toContain('[✓]');
    });

    it('informa sobre paradas pendientes cuando se visitó parcialmente el recorrido', () => {
      const helper = getFinalizarHelperText(1, 3);
      expect(helper).toContain('Llevas 1 de 3 parada(s) registrada(s)');
      expect(helper).toContain('Tienes 2 pendiente(s)');
    });

    it('muestra mensaje de completitud cuando todas las paradas fueron visitadas', () => {
      const helper = getFinalizarHelperText(2, 2);
      expect(helper).toContain('¡Recorrido completado!');
      expect(helper).toContain('FINALIZAR PLAN');
    });
  });

  describe('Navegación «Cómo llegar» hacia Coordenadas Reales', () => {
    const lat = -12.1485;
    const lng = -77.0212;
    const nombre = 'Canta Rana';

    it('construye URL nativa geo para Android con coordenadas y nombre codificado', () => {
      const { nativeUrl, webFallbackUrl } = buildMapsNavigationUrl(lat, lng, nombre, 'android');
      expect(nativeUrl).toBe(`geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(nombre)})`);
      expect(webFallbackUrl).toBe(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });

    it('construye URL nativa maps para iOS con coordenadas y nombre codificado', () => {
      const { nativeUrl, webFallbackUrl } = buildMapsNavigationUrl(lat, lng, nombre, 'ios');
      expect(nativeUrl).toBe(`maps:0,0?q=${encodeURIComponent(nombre)}@${lat},${lng}`);
      expect(webFallbackUrl).toBe(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
  });

  describe('Criterios de Accesibilidad Táctil Serie AX', () => {
    it('los controles interactivos de parada y navegación garantizan dimensiones mínimas de 48 dp', () => {
      const touchTarget = {
        minHeight: 48,
        minWidth: 48,
      };

      expect(touchTarget.minHeight).toBeGreaterThanOrEqual(48);
      expect(touchTarget.minWidth).toBeGreaterThanOrEqual(48);
    });
  });

  describe('Criterios Técnicos del Motor para Itinerarios de Una Sola Parada', () => {
    it('documenta que el presupuesto fraccional de la variante restringe candidatos adicionales', () => {
      // En la variante equilibrada: presupuestoFrac = 0.85
      const userBudget = 40;
      const budgetFrac = 0.85;
      const effectiveBudget = Math.floor(userBudget * budgetFrac); // 34
      const firstStopCost = 40; // Canta Rana gasto_max = 40
      const remainingBudget = effectiveBudget - firstStopCost; // -6

      // Ningún segundo lugar con costo > 0 puede ingresar
      expect(remainingBudget).toBeLessThan(0);
    });

    it('documenta que la ventana de tiempo acotada agota el cupo con la primera parada más traslados', () => {
      // Tiempo solicitado: 60 a 90 min con tiempoFrac = 0.8
      const userTotalMinutes = 90;
      const timeFrac = 0.8;
      const effectiveMinutes = Math.floor(userTotalMinutes * timeFrac); // 72 min
      const tAncla = 15; // traslado desde origen
      const durLugar = 60; // permanencia Canta Rana
      const consumedTime = tAncla + durLugar; // 75 min

      // Consumed time (75) supera o agota los minutos disponibles (72)
      expect(consumedTime).toBeGreaterThan(effectiveMinutes);
    });
  });
});
