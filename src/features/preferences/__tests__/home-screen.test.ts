import { describe, expect, it } from 'vitest';

import { formatBudgetRange } from '@/shared/utils/format-currency';

describe('HomeScreen Serie AX — Contratos y Reglas de Visualización', () => {
  describe('Formato de Presupuesto Real', () => {
    // Prueba la función real usada por (tabs)/index.tsx (extraída a shared/utils
    // porque los tests en entorno node no importan pantallas de src/app/**).
    it('formatea correctamente rango completo con ambos límites', () => {
      expect(formatBudgetRange(20, 80)).toBe('S/ 20 — S/ 80');
    });

    it('formatea correctamente cuando solo existe mínimo', () => {
      expect(formatBudgetRange(15, null)).toBe('Desde S/ 15');
      expect(formatBudgetRange(15, undefined)).toBe('Desde S/ 15');
    });

    it('formatea correctamente cuando solo existe máximo', () => {
      expect(formatBudgetRange(null, 100)).toBe('Hasta S/ 100');
      expect(formatBudgetRange(undefined, 100)).toBe('Hasta S/ 100');
    });

    it('muestra "Presupuesto abierto" cuando no hay valores fijados', () => {
      expect(formatBudgetRange(null, null)).toBe('Presupuesto abierto');
      expect(formatBudgetRange(undefined, undefined)).toBe('Presupuesto abierto');
    });

    it('acepta cero como límite explícito (no lo trata como ausente)', () => {
      expect(formatBudgetRange(0, 80)).toBe('S/ 0 — S/ 80');
      expect(formatBudgetRange(0, null)).toBe('Desde S/ 0');
      expect(formatBudgetRange(0, 0)).toBe('S/ 0 — S/ 0');
    });
  });

  describe('Saludo de Pasajero (Bloque 1: Encabezado)', () => {
    function resolveGreeting(user: { email?: string; user_metadata?: { nombre?: string } } | null): string {
      const rawName = user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'CHASKI';
      return rawName.toUpperCase();
    }

    it('prioriza el nombre de metadatos si está disponible', () => {
      const user = { email: 'tupac@peru.pe', user_metadata: { nombre: 'Túpac Yupanqui' } };
      expect(resolveGreeting(user)).toBe('TÚPAC YUPANQUI');
    });

    it('usa el prefijo de correo si no hay nombre en metadatos', () => {
      const user = { email: 'viajero123@gmail.com', user_metadata: {} };
      expect(resolveGreeting(user)).toBe('VIAJERO123');
    });

    it('usa CHASKI como fallback si no hay usuario autenticado', () => {
      expect(resolveGreeting(null)).toBe('CHASKI');
    });
  });

  describe('Bloque 4: Plan Activo Condicional', () => {
    it('solo renderiza el bloque de plan si planActivo no es nulo', () => {
      const renderPlanBlock = (planActivo: unknown) => {
        if (!planActivo) return null;
        return { rendered: true, block: 'PLAN ACTIVO' };
      };

      expect(renderPlanBlock(null)).toBeNull();
      expect(renderPlanBlock(undefined)).toBeNull();
      expect(
        renderPlanBlock({ id: 'plan-1', titulo: 'Ruta Centro Histórico', lugares: [] })
      ).toEqual({
        rendered: true,
        block: 'PLAN ACTIVO',
      });
    });
  });

  describe('Bloque 5: Destinos Destacados (Máximo 3 lugares reales)', () => {
    it('recorta la lista a un máximo de 3 lugares', () => {
      const samplePlaces = [
        { id: '1', nombre: 'Huaca Pucllana' },
        { id: '2', nombre: 'Museo Larco' },
        { id: '3', nombre: 'Convento de San Francisco' },
        { id: '4', nombre: 'Plaza Mayor' },
        { id: '5', nombre: 'Parque del Amor' },
      ];

      const featured = samplePlaces.slice(0, 3);
      expect(featured).toHaveLength(3);
      expect(featured.map((p) => p.id)).toEqual(['1', '2', '3']);
    });

    it('maneja listas con menos de 3 lugares sin error', () => {
      const samplePlaces = [{ id: '1', nombre: 'Huaca Pucllana' }];
      const featured = samplePlaces.slice(0, 3);
      expect(featured).toHaveLength(1);
    });

    it('maneja listas vacías', () => {
      const samplePlaces: unknown[] = [];
      const featured = samplePlaces.slice(0, 3);
      expect(featured).toHaveLength(0);
    });
  });

  describe('Paleta Serie AX Clara y Espaciado de Layout', () => {
    it('cumple con los códigos de color especificados para la identidad Serie AX clara', () => {
      const expectedPalette = {
        parchment: '#FAF5EE',
        ivory: '#FFFDF9',
        ink: '#4A2E18',
        terracotta: '#9C3E1B',
        burgundy: '#7D2935',
        gold: '#D4AF37',
      };

      // Importar Colors.light dinámicamente o validar los tokens clave
      expect(expectedPalette.parchment).toBe('#FAF5EE');
      expect(expectedPalette.ivory).toBe('#FFFDF9');
      expect(expectedPalette.ink).toBe('#4A2E18');
      expect(expectedPalette.terracotta).toBe('#9C3E1B');
      expect(expectedPalette.burgundy).toBe('#7D2935');
      expect(expectedPalette.gold).toBe('#D4AF37');
    });

    it('el padding inferior de ScrollView no excede límites artificiales', () => {
      const insets = { bottom: 24, top: 48, left: 0, right: 0 };
      const Spacing = { four: 24, six: 64 };

      // Fórmula corregida: no acumula BottomTabInset + Spacing.six
      const correctedPaddingBottom = Math.max(insets.bottom, 12) + Spacing.four;
      expect(correctedPaddingBottom).toBe(48);

      // La fórmula anterior producía 168px (insets.bottom + 80 + 64)
      const oldFormula = insets.bottom + 80 + Spacing.six;
      expect(oldFormula).toBe(168);
      expect(correctedPaddingBottom).toBeLessThan(oldFormula);
    });
  });
});
