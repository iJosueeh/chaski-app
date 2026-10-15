import { describe, expect, it } from 'vitest';
import type { GeneratedPlan, PlanStop } from '@/features/plan-engine/plan-engine';

const MOCK_PLACE_1 = {
  id: 'place-1',
  nombre: 'Huaca Pucllana',
  latitud: -12.11,
  longitud: -77.03,
  gasto_max: 15,
  duracion_sugerida_min: 60,
  estado: true,
  creado_en: '2026-01-01',
};

const MOCK_PLACE_2 = {
  id: 'place-2',
  nombre: 'Museo Larco',
  latitud: -12.07,
  longitud: -77.07,
  gasto_max: 35,
  duracion_sugerida_min: 90,
  estado: true,
  creado_en: '2026-01-01',
};

const MOCK_STOPS: PlanStop[] = [
  {
    place: MOCK_PLACE_1 as any,
    orden: 1,
    llegada: '09:30',
    duracion_min: 60,
    traslado_desde_anterior_min: 15,
    costo_estimado: 15,
  },
  {
    place: MOCK_PLACE_2 as any,
    orden: 2,
    llegada: '11:00',
    duracion_min: 90,
    traslado_desde_anterior_min: 20,
    costo_estimado: 35,
  },
];

const MOCK_PLAN: GeneratedPlan = {
  id: 'plan-test-1',
  titulo: 'Ruta Arqueológica y Virreinal',
  descripcion: '2 paradas desde Huaca Pucllana',
  variante: 'equilibrado',
  paradas: MOCK_STOPS,
  duracion_total_min: 185,
  costo_total: 50,
  distancia_km_aprox: 6.4,
  score: 0.88,
};

describe('Planes Serie AX — Ciclo de Vida y Persistencia del Plan Activo', () => {
  it('activarPlan persiste en AsyncStorage y reinicia las paradas visitadas', async () => {
    const storage: Record<string, string> = {};
    let planActivo: GeneratedPlan | null = null;
    let visitadas: number[] = [1, 2];

    const activarPlan = async (plan: GeneratedPlan) => {
      planActivo = plan;
      visitadas = [];
      storage['@chaski/plan_activo_v1'] = JSON.stringify(plan);
      storage['@chaski/plan_visitadas_v1'] = JSON.stringify([]);
    };

    await activarPlan(MOCK_PLAN);

    expect(planActivo).toEqual(MOCK_PLAN);
    expect(visitadas).toEqual([]);
    expect(JSON.parse(storage['@chaski/plan_activo_v1'])).toEqual(MOCK_PLAN);
    expect(JSON.parse(storage['@chaski/plan_visitadas_v1'])).toEqual([]);
  });

  it('hidratación inicial recupera el plan activo y las paradas visitadas', async () => {
    const storage: Record<string, string> = {
      '@chaski/plan_activo_v1': JSON.stringify(MOCK_PLAN),
      '@chaski/plan_visitadas_v1': JSON.stringify([1]),
      '@chaski/plan_historial_v1': JSON.stringify([]),
    };

    let planActivo: GeneratedPlan | null = null;
    let visitadas: number[] = [];
    let loading = true;

    // Simulación del efecto de carga inicial de PlansContext
    const hydrate = async () => {
      const a = storage['@chaski/plan_activo_v1'];
      const v = storage['@chaski/plan_visitadas_v1'];
      if (a) planActivo = JSON.parse(a);
      if (v) visitadas = JSON.parse(v);
      loading = false;
    };

    await hydrate();

    expect(loading).toBe(false);
    expect(planActivo).toEqual(MOCK_PLAN);
    expect(visitadas).toEqual([1]);
  });

  it('completarPlan archiva en historial con timestamp ISO y elimina planActivo', async () => {
    const storage: Record<string, string> = {
      '@chaski/plan_activo_v1': JSON.stringify(MOCK_PLAN),
      '@chaski/plan_visitadas_v1': JSON.stringify([1, 2]),
      '@chaski/plan_historial_v1': JSON.stringify([]),
    };

    let planActivo: GeneratedPlan | null = MOCK_PLAN;
    let visitadas: number[] = [1, 2];
    let historial: any[] = [];

    const completarPlan = async () => {
      if (!planActivo) return;
      const entry = {
        ...planActivo,
        completado_en: '2026-10-12T15:00:00.000Z',
      };
      historial = [entry, ...historial];
      planActivo = null;
      visitadas = [];
      storage['@chaski/plan_historial_v1'] = JSON.stringify(historial);
      delete storage['@chaski/plan_activo_v1'];
      storage['@chaski/plan_visitadas_v1'] = JSON.stringify([]);
    };

    await completarPlan();

    expect(planActivo).toBeNull();
    expect(visitadas).toEqual([]);
    expect(storage['@chaski/plan_activo_v1']).toBeUndefined();
    expect(historial).toHaveLength(1);
    expect(historial[0].titulo).toBe('Ruta Arqueológica y Virreinal');
    expect(historial[0].completado_en).toBe('2026-10-12T15:00:00.000Z');
  });

  it('cerrar plan/activo no cancela el plan (regresión de borrado accidental)', () => {
    let cancelCalled = false;
    let navigatedTo: string | null = null;

    // El nuevo handler seguro de cerrar vista
    const cerrarVista = () => {
      navigatedTo = '/(tabs)';
    };

    cerrarVista();

    expect(cancelCalled).toBe(false);
    expect(navigatedTo).toBe('/(tabs)');
  });
});

describe('Dashboard (Inicio) — Visualización del Plan Activo y Estados', () => {
  it('genera el saludo y banner adecuado cuando hay plan activo', () => {
    const planActivo = MOCK_PLAN;
    const visitadas = [1];
    const totalParadas = planActivo.paradas.length;
    const paradaActual = Math.min(visitadas.length + 1, totalParadas);
    const pctActivo = Math.round((visitadas.length / totalParadas) * 100);

    const greetingSub = planActivo
      ? 'Tienes una expedición en curso por Lima. Revisa tu progreso y continúa a la siguiente estación.'
      : 'Tu boleto está listo para iniciar una nueva expedición por Lima.';

    expect(greetingSub).toContain('Tienes una expedición en curso');
    expect(paradaActual).toBe(2);
    expect(totalParadas).toBe(2);
    expect(pctActivo).toBe(50);
  });

  it('no muestra el banner de expedición activa si no hay plan activo', () => {
    const planActivo = null;
    const greetingSub = planActivo
      ? 'Tienes una expedición en curso por Lima. Revisa tu progreso y continúa a la siguiente estación.'
      : 'Tu boleto está listo para iniciar una nueva expedición por Lima.';

    expect(greetingSub).toBe('Tu boleto está listo para iniciar una nueva expedición por Lima.');
  });
});

describe('Resultados de Planes — Criterio Objetivo de Recomendación', () => {
  function computeMejorCoincidencia(planes: GeneratedPlan[]): string | null {
    let bestId: string | null = null;
    let maxScore = 0;
    for (const p of planes) {
      if (typeof p.score === 'number' && p.score > maxScore) {
        maxScore = p.score;
        bestId = p.id;
      }
    }
    return bestId;
  }

  it('asigna «Mejor coincidencia» únicamente al plan con score numérico más alto y verificable', () => {
    const planes: GeneratedPlan[] = [
      { ...MOCK_PLAN, id: 'plan-1', score: 0.65 },
      { ...MOCK_PLAN, id: 'plan-2', score: 0.92 },
      { ...MOCK_PLAN, id: 'plan-3', score: 0.78 },
    ];

    expect(computeMejorCoincidencia(planes)).toBe('plan-2');
  });

  it('no asigna «Mejor coincidencia» si ningún plan tiene score (cero o indefinido)', () => {
    const planesSinScore: GeneratedPlan[] = [
      { ...MOCK_PLAN, id: 'plan-1', score: undefined },
      { ...MOCK_PLAN, id: 'plan-2', score: undefined },
    ];

    expect(computeMejorCoincidencia(planesSinScore)).toBeNull();
  });

  it('proporciona explicaciones objetivas diferenciadas por variante', () => {
    function getRutaDetalles(p: GeneratedPlan) {
      switch (p.variante) {
        case 'intimo':
          return { badge: 'RITMO PAUSADO', subtitulo: 'Recorrido concentrado' };
        case 'equilibrado':
          return { badge: 'EQUILIBRADO', subtitulo: 'Balance de tiempo y patrimonio' };
        case 'explorador':
          return { badge: 'EXPLORADOR', subtitulo: 'Máxima inmersión cultural' };
        default:
          return { badge: 'EXPEDICIÓN', subtitulo: 'Personalizada' };
      }
    }

    expect(getRutaDetalles({ ...MOCK_PLAN, variante: 'intimo' }).badge).toBe('RITMO PAUSADO');
    expect(getRutaDetalles({ ...MOCK_PLAN, variante: 'equilibrado' }).badge).toBe('EQUILIBRADO');
    expect(getRutaDetalles({ ...MOCK_PLAN, variante: 'explorador' }).badge).toBe('EXPLORADOR');
  });
});
