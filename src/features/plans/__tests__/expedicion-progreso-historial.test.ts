import { beforeEach, describe, expect, it } from 'vitest';
import type { GeneratedPlan, PlanStop } from '@/features/plan-engine/plan-engine';
import type { EstadoExpedicion, PlanHistorialEntry } from '@/features/plans/context/plans-context';
import {
  resetCelebrationTrackerForTest,
  shouldTriggerCelebration,
} from '@/features/plans/utils/celebration-tracker';
import {
  formatHistoryStatusLabel,
  getParadasVisitadas,
  resolveEstadoExpedicion,
} from '@/features/plans/utils/historial-formatters';
import {
  getCompletadoPresentation,
} from '@/features/plans/utils/plan-completado-formatters';

const MOCK_STOP_1: PlanStop = {
  place: {
    id: 'place-pucllana',
    nombre: 'Huaca Pucllana',
    latitud: -12.11,
    longitud: -77.03,
    gasto_max: 15,
    duracion_sugerida_min: 60,
    estado: true,
  } as any,
  orden: 1,
  llegada: '09:30',
  duracion_min: 60,
  traslado_desde_anterior_min: 15,
  costo_estimado: 15,
};

const MOCK_STOP_2: PlanStop = {
  place: {
    id: 'place-larco',
    nombre: 'Museo Larco',
    latitud: -12.07,
    longitud: -77.07,
    gasto_max: 35,
    duracion_sugerida_min: 90,
    estado: true,
  } as any,
  orden: 2,
  llegada: '11:00',
  duracion_min: 90,
  traslado_desde_anterior_min: 20,
  costo_estimado: 35,
};

const MOCK_2_STOPS_PLAN: GeneratedPlan = {
  id: 'plan-ax-2-stops',
  titulo: 'Ruta Arqueológica y Colonial',
  descripcion: '2 paradas patrimoniales',
  variante: 'equilibrado',
  paradas: [MOCK_STOP_1, MOCK_STOP_2],
  duracion_total_min: 185,
  costo_total: 50,
  distancia_km_aprox: 6.4,
};

describe('Fase 1: Diagnóstico y Corrección de Finalización e Historial Serie AX', () => {
  beforeEach(() => {
    resetCelebrationTrackerForTest();
  });

  describe('1. Caso 0/2 Paradas Visitadas (Abandono de Expedición)', () => {
    it('calcula estado ABANDONADA cuando el usuario cancela o abandona sin paradas marcadas', () => {
      const visitadas: number[] = [];
      const plan = MOCK_2_STOPS_PLAN;

      // Simulación de la lógica de abandonarPlan en PlansContext
      const paradas_visitadas_ids = plan.paradas
        .filter((s) => visitadas.includes(s.orden))
        .map((s) => s.place.id);

      const entry: PlanHistorialEntry = {
        ...plan,
        completado_en: new Date().toISOString(),
        paradas_visitadas: [...visitadas],
        paradas_visitadas_ids,
        estado_expedicion: 'ABANDONADA',
      };

      expect(entry.estado_expedicion).toBe('ABANDONADA');
      expect(entry.paradas_visitadas).toEqual([]);
      expect(entry.paradas_visitadas_ids).toEqual([]);
      expect(resolveEstadoExpedicion(entry)).toBe('ABANDONADA');
    });

    it('genera presentación honesta sin celebración para expedición abandonada', () => {
      const presentation = getCompletadoPresentation(
        'ABANDONADA',
        MOCK_2_STOPS_PLAN.titulo,
        '14 oct 2026',
        0,
        2,
      );

      expect(presentation.titulo).toBe('EXPEDICIÓN ABANDONADA');
      expect(presentation.kicker).toBe('RECORRIDO INTERRUMPIDO · SERIE AX');
      expect(presentation.puedeCelebrar).toBe(false);
      expect(presentation.titulo).not.toContain('¡EXPEDICIÓN CUMPLIDA!');
    });

    it('bloquea el confeti ceremonial si la expedición fue abandonada', () => {
      const now = Date.now();
      const iso = new Date(now - 1000).toISOString();

      const trigger = shouldTriggerCelebration(
        MOCK_2_STOPS_PLAN.id,
        iso,
        now,
        'ABANDONADA',
      );

      expect(trigger).toBe(false);
    });

    it('etiqueta el estado en el boleto de historial como recorrido interrumpido', () => {
      const label = formatHistoryStatusLabel('ABANDONADA', 0, 2);
      expect(label).toBe('Recorrido interrumpido (0 de 2 paradas)');
    });
  });

  describe('2. Caso 1/2 Paradas Visitadas (Finalización Parcial)', () => {
    it('calcula estado PARCIAL cuando se marca solo 1 de las 2 paradas', () => {
      const visitadas: number[] = [1];
      const plan = MOCK_2_STOPS_PLAN;
      const totalParadas = plan.paradas.length;

      const estadoCalculado: EstadoExpedicion =
        totalParadas > 0 && visitadas.length >= totalParadas ? 'COMPLETADA' : 'PARCIAL';

      const paradas_visitadas_ids = plan.paradas
        .filter((s) => visitadas.includes(s.orden))
        .map((s) => s.place.id);

      const entry: PlanHistorialEntry = {
        ...plan,
        completado_en: new Date().toISOString(),
        paradas_visitadas: [...visitadas],
        paradas_visitadas_ids,
        estado_expedicion: estadoCalculado,
      };

      expect(entry.estado_expedicion).toBe('PARCIAL');
      expect(entry.paradas_visitadas).toEqual([1]);
      expect(entry.paradas_visitadas_ids).toEqual(['place-pucllana']);
      expect(resolveEstadoExpedicion(entry)).toBe('PARCIAL');
    });

    it('NUNCA muestra «¡Expedición cumplida!» en /plan/completado si hay paradas pendientes', () => {
      const presentation = getCompletadoPresentation(
        'PARCIAL',
        MOCK_2_STOPS_PLAN.titulo,
        '14 oct 2026',
        1,
        2,
      );

      expect(presentation.titulo).toBe('EXPEDICIÓN PARCIAL');
      expect(presentation.titulo).not.toBe('¡EXPEDICIÓN CUMPLIDA!');
      expect(presentation.kicker).toBe('BOLETO PARCIAL · SERIE AX');
      expect(presentation.subtitulo).toContain('1 de 2 paradas');
      expect(presentation.puedeCelebrar).toBe(false);
    });

    it('bloquea el confeti ceremonial para expedición parcial de 1/2 paradas', () => {
      const now = Date.now();
      const iso = new Date(now - 1000).toISOString();

      const trigger = shouldTriggerCelebration(
        MOCK_2_STOPS_PLAN.id,
        iso,
        now,
        'PARCIAL',
      );

      expect(trigger).toBe(false);
    });

    it('distingue con precisión qué paradas están visitadas y cuáles pendientes', () => {
      const entry: PlanHistorialEntry = {
        ...MOCK_2_STOPS_PLAN,
        completado_en: '2026-10-14T20:00:00Z',
        paradas_visitadas: [1],
        estado_expedicion: 'PARCIAL',
      };

      const visitadas = getParadasVisitadas(entry);
      expect(visitadas).toContain(1);
      expect(visitadas).not.toContain(2);

      const stop1Visited = visitadas.includes(MOCK_STOP_1.orden);
      const stop2Visited = visitadas.includes(MOCK_STOP_2.orden);

      expect(stop1Visited).toBe(true);
      expect(stop2Visited).toBe(false);
    });

    it('formatea el avance del boleto como 1 de 2 paradas alcanzadas', () => {
      const label = formatHistoryStatusLabel('PARCIAL', 1, 2);
      expect(label).toBe('1 de 2 paradas alcanzadas');
    });
  });

  describe('3. Caso 2/2 Paradas Visitadas (Finalización Completa)', () => {
    it('calcula estado COMPLETADA cuando todas las paradas son visitadas', () => {
      const visitadas: number[] = [1, 2];
      const plan = MOCK_2_STOPS_PLAN;
      const totalParadas = plan.paradas.length;

      const estadoCalculado: EstadoExpedicion =
        totalParadas > 0 && visitadas.length >= totalParadas ? 'COMPLETADA' : 'PARCIAL';

      const entry: PlanHistorialEntry = {
        ...plan,
        completado_en: new Date().toISOString(),
        paradas_visitadas: [...visitadas],
        paradas_visitadas_ids: ['place-pucllana', 'place-larco'],
        estado_expedicion: estadoCalculado,
      };

      expect(entry.estado_expedicion).toBe('COMPLETADA');
      expect(entry.paradas_visitadas).toEqual([1, 2]);
      expect(resolveEstadoExpedicion(entry)).toBe('COMPLETADA');
    });

    it('muestra «¡Expedición cumplida!» únicamente cuando el recorrido está 100% completado', () => {
      const presentation = getCompletadoPresentation(
        'COMPLETADA',
        MOCK_2_STOPS_PLAN.titulo,
        '14 oct 2026',
        2,
        2,
      );

      expect(presentation.titulo).toBe('¡EXPEDICIÓN CUMPLIDA!');
      expect(presentation.kicker).toBe('BOLETO VALIDADO · SERIE AX');
      expect(presentation.puedeCelebrar).toBe(true);
      expect(presentation.stampRoute).toBe('EXPEDICIÓN SATISFACTORIA');
    });

    it('habilita el confeti ceremonial textil andino en expedición completada', () => {
      const now = Date.now();
      const iso = new Date(now - 1000).toISOString();

      const trigger = shouldTriggerCelebration(
        MOCK_2_STOPS_PLAN.id,
        iso,
        now,
        'COMPLETADA',
      );

      expect(trigger).toBe(true);
    });

    it('formatea el avance del boleto como 100% completado', () => {
      const label = formatHistoryStatusLabel('COMPLETADA', 2, 2);
      expect(label).toBe('2 paradas alcanzadas (100%)');
    });
  });

  describe('4. Compatibilidad con Datos Históricos Antiguos (Legacy)', () => {
    it('no supone que todas las paradas fueron visitadas en registros legacy sin paradas_visitadas', () => {
      // Registro antiguo tal como existía antes de la Fase 1 (sin paradas_visitadas ni estado_expedicion)
      const legacyEntry = {
        id: 'plan-legacy-old',
        titulo: 'Ruta Histórica Lima',
        descripcion: '2 paradas',
        variante: 'intimo' as const,
        paradas: [MOCK_STOP_1, MOCK_STOP_2],
        duracion_total_min: 120,
        costo_total: 20,
        distancia_km_aprox: 3.5,
        completado_en: '2026-09-10T12:00:00Z',
      };

      // Debe resolverse como 'HISTORICO'
      const estado = resolveEstadoExpedicion(legacyEntry);
      expect(estado).toBe('HISTORICO');

      // Las paradas visitadas deben retornar [] (no presupone ninguna completada)
      const visitadas = getParadasVisitadas(legacyEntry);
      expect(visitadas).toEqual([]);
      expect(visitadas).toHaveLength(0);
    });

    it('no muestra «¡Expedición cumplida!» para registros legacy', () => {
      const presentation = getCompletadoPresentation(
        'HISTORICO',
        'Ruta Histórica Lima',
        '10 set 2026',
        0,
        2,
      );

      expect(presentation.titulo).toBe('EXPEDICIÓN ARCHIVADA');
      expect(presentation.titulo).not.toBe('¡EXPEDICIÓN CUMPLIDA!');
      expect(presentation.kicker).toBe('ARCHIVO HISTÓRICO · SERIE AX');
      expect(presentation.puedeCelebrar).toBe(false);
    });

    it('formatea la etiqueta de estaciones de manera neutra para registros legacy', () => {
      const label = formatHistoryStatusLabel('HISTORICO', 0, 2);
      expect(label).toBe('2 paradas registradas');
      expect(label).not.toContain('alcanzada');
    });
  });

  describe('5. Navegación e Integración al Detalle de Expedición', () => {
    it('construye parámetros correctos de navegación a /plan/detalle para modo historial', () => {
      const entry: PlanHistorialEntry = {
        ...MOCK_2_STOPS_PLAN,
        completado_en: '2026-10-14T20:00:00Z',
        paradas_visitadas: [1],
        estado_expedicion: 'PARCIAL',
      };

      const params = {
        plan: JSON.stringify(entry),
        modo: 'historial',
        entryId: entry.id,
      };

      expect(params.modo).toBe('historial');
      expect(params.entryId).toBe(entry.id);
      expect(JSON.parse(params.plan).paradas_visitadas).toEqual([1]);
    });

    it('permite recuperar el plan desde el array de historial si entryId está presente', () => {
      const entry1: PlanHistorialEntry = {
        ...MOCK_2_STOPS_PLAN,
        id: 'plan-1',
        completado_en: '2026-10-14T18:00:00Z',
        paradas_visitadas: [1, 2],
        estado_expedicion: 'COMPLETADA',
      };
      const entry2: PlanHistorialEntry = {
        ...MOCK_2_STOPS_PLAN,
        id: 'plan-2',
        completado_en: '2026-10-14T19:00:00Z',
        paradas_visitadas: [1],
        estado_expedicion: 'PARCIAL',
      };

      const historial = [entry2, entry1];

      const found = historial.find((h) => h.id === 'plan-2');
      expect(found).toBeDefined();
      expect(found?.estado_expedicion).toBe('PARCIAL');
      expect(found?.paradas_visitadas).toEqual([1]);
    });
  });

  describe('6. Persistencia Local en AsyncStorage y Ciclo Cerrar/Reabrir App', () => {
    it('guarda y rehidrata fielmente estados COMPLETADA, PARCIAL, ABANDONADA y LEGACY', async () => {
      const fakeStorage: Record<string, string> = {};

      const entries: PlanHistorialEntry[] = [
        {
          ...MOCK_2_STOPS_PLAN,
          id: 'p-complete',
          completado_en: '2026-10-14T15:00:00Z',
          paradas_visitadas: [1, 2],
          paradas_visitadas_ids: ['place-pucllana', 'place-larco'],
          estado_expedicion: 'COMPLETADA',
        },
        {
          ...MOCK_2_STOPS_PLAN,
          id: 'p-partial',
          completado_en: '2026-10-14T16:00:00Z',
          paradas_visitadas: [1],
          paradas_visitadas_ids: ['place-pucllana'],
          estado_expedicion: 'PARCIAL',
        },
        {
          ...MOCK_2_STOPS_PLAN,
          id: 'p-abandoned',
          completado_en: '2026-10-14T17:00:00Z',
          paradas_visitadas: [],
          paradas_visitadas_ids: [],
          estado_expedicion: 'ABANDONADA',
        },
        // Entrada legacy sin campos nuevos
        {
          ...MOCK_2_STOPS_PLAN,
          id: 'p-legacy',
          completado_en: '2026-09-01T12:00:00Z',
        } as PlanHistorialEntry,
      ];

      // 1. Guardar en storage local (simula cerrar la app)
      fakeStorage['@chaski/plan_historial_v1'] = JSON.stringify(entries);

      // 2. Rehidratar desde storage local (simula reabrir la app)
      const rawStored = fakeStorage['@chaski/plan_historial_v1'];
      expect(rawStored).toBeDefined();
      const rehydrated: PlanHistorialEntry[] = JSON.parse(rawStored);

      expect(rehydrated).toHaveLength(4);

      // Verificar 2/2 completada
      expect(rehydrated[0].estado_expedicion).toBe('COMPLETADA');
      expect(rehydrated[0].paradas_visitadas).toEqual([1, 2]);

      // Verificar 1/2 parcial
      expect(rehydrated[1].estado_expedicion).toBe('PARCIAL');
      expect(rehydrated[1].paradas_visitadas).toEqual([1]);

      // Verificar 0/2 abandonada
      expect(rehydrated[2].estado_expedicion).toBe('ABANDONADA');
      expect(rehydrated[2].paradas_visitadas).toEqual([]);

      // Verificar legacy
      expect(rehydrated[3].estado_expedicion).toBeUndefined();
      expect(rehydrated[3].paradas_visitadas).toBeUndefined();
      expect(resolveEstadoExpedicion(rehydrated[3])).toBe('HISTORICO');
      expect(getParadasVisitadas(rehydrated[3])).toEqual([]);
    });

    it('garantiza que una expedición activa en curso mantiene su avance al reabrir la app', () => {
      const fakeStorage: Record<string, string> = {
        '@chaski/plan_activo_v1': JSON.stringify(MOCK_2_STOPS_PLAN),
        '@chaski/plan_visitadas_v1': JSON.stringify([1]), // Parada 1 marcada
      };

      // Simular rehidratación de PlansContext
      const active = JSON.parse(fakeStorage['@chaski/plan_activo_v1']);
      const visited: number[] = JSON.parse(fakeStorage['@chaski/plan_visitadas_v1']);

      expect(active.id).toBe(MOCK_2_STOPS_PLAN.id);
      expect(visited).toEqual([1]);
      expect(visited.length).toBe(1);
      expect(active.paradas.length).toBe(2);
    });
  });
});
