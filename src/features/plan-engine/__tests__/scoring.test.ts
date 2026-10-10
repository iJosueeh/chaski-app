import { describe, expect, it } from 'vitest';
import {
  calculateBudgetCompatibilityScore,
  calculateInterestCoverageScore,
  calculateMultiCriteriaScore,
  calculateTimeUtilizationScore,
  calculateTravelEfficiencyScore,
  PESOS_SCORING,
} from '../scoring';
import { generarPlanes, type PlanStop } from '../plan-engine';
import type { Place } from '@/features/places/interface/places.interface';
import type { WizardPlanRequest } from '@/features/wizard/context/wizard-context';

function createMockPlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'p-1',
    nombre: 'Lugar de Prueba',
    descripcion: 'Descripción',
    direccion: 'Av. Larco 100',
    latitud: -12.121,
    longitud: -77.03,
    gasto_min: 0,
    gasto_max: 20,
    duracion_sugerida_min: 30,
    estado: true,
    fuente: 'curada',
    external_id: null,
    tipo_disponibilidad: 'HORARIO_REGISTRADO',
    fecha_actualizacion: '2026-09-01T00:00:00Z',
    categorias: [{ id: 'cat-1', nombre: 'Cultura' }],
    etiquetas: [],
    horarios: [
      { id: 'h-1', dia_semana: 1, hora_apertura: '09:00', hora_cierre: '18:00' },
    ],
    ...overrides,
  };
}

function createMockStop(place: Place, overrides: Partial<PlanStop> = {}): PlanStop {
  return {
    place,
    orden: 1,
    llegada: '09:00',
    duracion_min: place.duracion_sugerida_min ?? 30,
    traslado_desde_anterior_min: 10,
    costo_estimado: place.gasto_max ?? 0,
    ...overrides,
  };
}

function createMockRequest(overrides: Partial<WizardPlanRequest> = {}): WizardPlanRequest {
  return {
    ubicacion: {
      modo: 'gps',
      nombre: 'Punto de partida',
      lat: -12.121,
      lng: -77.03,
    },
    minutosTotales: 240,
    horaInicio: '09:00',
    horaFin: '13:00',
    presupuesto: 100,
    intereses: [],
    movilidad: 'caminando',
    diaSemana: 1,
    ...overrides,
  };
}

describe('Módulo de Scoring Multicriterio', () => {
  describe('Pesos y normalización', () => {
    it('los pesos de los criterios suman exactamente 1.0 (100 %)', () => {
      const suma =
        PESOS_SCORING.coberturaIntereses +
        PESOS_SCORING.aprovechamientoTiempo +
        PESOS_SCORING.compatibilidadPresupuesto +
        PESOS_SCORING.eficienciaDesplazamiento;
      expect(suma).toBeCloseTo(1.0, 5);
      expect(PESOS_SCORING.coberturaIntereses).toBe(0.35);
      expect(PESOS_SCORING.aprovechamientoTiempo).toBe(0.25);
      expect(PESOS_SCORING.compatibilidadPresupuesto).toBe(0.20);
      expect(PESOS_SCORING.eficienciaDesplazamiento).toBe(0.20);
    });

    it('el score total y los sub-scores siempre se mantienen en el rango [0, 100]', () => {
      const stop = createMockStop(createMockPlace());
      const result = calculateMultiCriteriaScore({
        paradas: [stop],
        interesesUsuario: ['Cultura'],
        tiempoTotalMin: 40,
        tiempoMaximoMin: 120,
        presupuestoMaximo: 50,
      });

      expect(result.coberturaIntereses).toBeGreaterThanOrEqual(0);
      expect(result.coberturaIntereses).toBeLessThanOrEqual(100);
      expect(result.aprovechamientoTiempo).toBeGreaterThanOrEqual(0);
      expect(result.aprovechamientoTiempo).toBeLessThanOrEqual(100);
      expect(result.compatibilidadPresupuesto).toBeGreaterThanOrEqual(0);
      expect(result.compatibilidadPresupuesto).toBeLessThanOrEqual(100);
      expect(result.eficienciaDesplazamiento).toBeGreaterThanOrEqual(0);
      expect(result.eficienciaDesplazamiento).toBeLessThanOrEqual(100);
      expect(result.scoreTotal).toBeGreaterThanOrEqual(0);
      expect(result.scoreTotal).toBeLessThanOrEqual(100);
    });
  });

  describe('1. Cobertura de Intereses (35 %)', () => {
    it('otorga 100 cuando el usuario no especificó intereses (exploración abierta)', () => {
      const stop = createMockStop(createMockPlace());
      const score = calculateInterestCoverageScore([stop], []);
      expect(score).toBe(100);
    });

    it('calcula la proporción exacta de categorías cubiertas', () => {
      // Naturaleza mapea a ['Parques', 'Miradores'] (2 categorías)
      const parque = createMockPlace({ categorias: [{ id: 'c1', nombre: 'Parques' }] });
      const mirador = createMockPlace({ categorias: [{ id: 'c2', nombre: 'Miradores' }] });

      const score1 = calculateInterestCoverageScore([createMockStop(parque)], ['Naturaleza']);
      expect(score1).toBe(50); // 1 de 2 cubiertas

      const score2 = calculateInterestCoverageScore(
        [createMockStop(parque), createMockStop(mirador)],
        ['Naturaleza'],
      );
      expect(score2).toBe(100); // 2 de 2 cubiertas
    });

    it('evita contar repetidamente una misma categoría como cobertura adicional', () => {
      // 3 paradas todas con "Cultura". Si se solicitó Historia (mapea a Cultura e Historia: 2 categorías)
      const museo1 = createMockPlace({ categorias: [{ id: 'c1', nombre: 'Cultura' }] });
      const museo2 = createMockPlace({ categorias: [{ id: 'c1', nombre: 'Cultura' }] });
      const museo3 = createMockPlace({ categorias: [{ id: 'c1', nombre: 'Cultura' }] });

      const score = calculateInterestCoverageScore(
        [createMockStop(museo1), createMockStop(museo2), createMockStop(museo3)],
        ['Historia'], // requiere 'Historia' y 'Cultura'
      );

      // Solo cubrió 'Cultura' (1 de 2 = 50 %), las 3 visitas a Cultura no inflan el puntaje a >50 %
      expect(score).toBe(50);
    });

    it('asigna 0 puntos de cobertura si los intereses seleccionados no tienen categorías compatibles en la BD', () => {
      // 'Compras' y 'Nocturno' no tienen categorías en MAPA_INTERESES_CATEGORIAS
      const museo = createMockPlace({ categorias: [{ id: 'c1', nombre: 'Cultura' }] });
      const score = calculateInterestCoverageScore([createMockStop(museo)], ['Compras']);
      expect(score).toBe(0);
    });
  });

  describe('2. Aprovechamiento del Tiempo (25 %)', () => {
    it('otorga 100 pts en la zona óptima de holgura razonable (75 % a 90 %)', () => {
      // 80 min de 100 min = 80 %
      const scoreOptimo = calculateTimeUtilizationScore(80, 100);
      expect(scoreOptimo).toBe(100);

      // 75 min de 100 min = 75 %
      expect(calculateTimeUtilizationScore(75, 100)).toBe(100);

      // 90 min de 100 min = 90 %
      expect(calculateTimeUtilizationScore(90, 100)).toBe(100);
    });

    it('no premia ocupar el 100 % del tiempo por encima de dejar un margen razonable', () => {
      const score80Porciento = calculateTimeUtilizationScore(80, 100);
      const score100Porciento = calculateTimeUtilizationScore(100, 100);

      expect(score80Porciento).toBe(100);
      expect(score100Porciento).toBe(90); // Deja menos holgura
      expect(score80Porciento).toBeGreaterThan(score100Porciento);
    });

    it('asigna 0 pts si el recorrido excede el tiempo disponible', () => {
      expect(calculateTimeUtilizationScore(110, 100)).toBe(0);
    });

    it('escala linealmente por debajo del 75 %', () => {
      // 37.5 min de 100 min = 37.5 % -> (37.5 / 75) * 100 = 50 pts
      expect(calculateTimeUtilizationScore(37.5, 100)).toBeCloseTo(50, 1);
    });
  });

  describe('3. Compatibilidad Presupuestaria (20 %)', () => {
    it('no premia automáticamente un mayor gasto y otorga 100 a rutas económicas o gratuitas', () => {
      const lugarGratis = createMockPlace({ gasto_min: 0, gasto_max: 0 });
      const lugarEconomico = createMockPlace({ gasto_min: 5, gasto_max: 10 });
      const lugarCaro = createMockPlace({ gasto_min: 70, gasto_max: 80 });

      const scoreGratis = calculateBudgetCompatibilityScore([createMockStop(lugarGratis)], 100);
      const scoreEco = calculateBudgetCompatibilityScore([createMockStop(lugarEconomico)], 100);
      const scoreCaro = calculateBudgetCompatibilityScore([createMockStop(lugarCaro)], 100);

      expect(scoreGratis).toBe(100);
      expect(scoreEco).toBe(100);
      expect(scoreCaro).toBe(100);
      // Gastar más NO recibe mayor puntuación que gastar menos
      expect(scoreGratis).toBeGreaterThanOrEqual(scoreCaro);
    });

    it('aplica leve penalización por riesgo si se apura el 100 % del presupuesto', () => {
      const lugarTope = createMockPlace({ gasto_min: 90, gasto_max: 100 });
      const score = calculateBudgetCompatibilityScore([createMockStop(lugarTope)], 100);
      expect(score).toBe(85);
    });

    it('asigna 0 si el gasto excede el presupuesto disponible', () => {
      const lugarExcede = createMockPlace({ gasto_min: 120, gasto_max: 150 });
      expect(calculateBudgetCompatibilityScore([createMockStop(lugarExcede)], 100)).toBe(0);
    });

    it('respeta gasto_min y gasto_max sin inventar valores ausentes', () => {
      const lugarSinMin = createMockPlace({ gasto_min: null, gasto_max: 20 });
      const score = calculateBudgetCompatibilityScore([createMockStop(lugarSinMin)], 100);
      expect(score).toBe(100);
    });
  });

  describe('4. Eficiencia de Desplazamiento (20 %)', () => {
    it('otorga 100 pts cuando el tiempo de visita es al menos el 75 % del tiempo total', () => {
      // 90 min visita + 10 min traslado = 100 min total (visita = 90 %)
      const parada = createMockStop(createMockPlace(), {
        duracion_min: 90,
        traslado_desde_anterior_min: 10,
      });
      expect(calculateTravelEfficiencyScore([parada])).toBe(100);
    });

    it('utiliza minutos de traslado y no distancia en km', () => {
      // Parada con 30 min visita y 30 min traslado (50 % visita)
      const parada = createMockStop(createMockPlace(), {
        duracion_min: 30,
        traslado_desde_anterior_min: 30,
      });
      // ratio = 30 / 60 = 0.50 -> (0.50 / 0.75) * 100 = 66.67
      expect(calculateTravelEfficiencyScore([parada])).toBeCloseTo(66.67, 1);
    });

    it('penaliza recorridos donde el traslado supera con creces el tiempo de visita', () => {
      // 15 min visita vs 60 min traslado (15/75 = 20 % visita)
      const parada = createMockStop(createMockPlace(), {
        duracion_min: 15,
        traslado_desde_anterior_min: 60,
      });
      // ratio = 15 / 75 = 0.20 -> (0.20 / 0.75) * 100 = 26.67
      expect(calculateTravelEfficiencyScore([parada])).toBeCloseTo(26.67, 1);
    });
  });

  describe('Determinismo y reproducibilidad', () => {
    it('calcula puntuaciones idénticas ante idénticas entradas', () => {
      const parada = createMockStop(createMockPlace());
      const p1 = calculateMultiCriteriaScore({
        paradas: [parada],
        interesesUsuario: ['Cultura'],
        tiempoTotalMin: 60,
        tiempoMaximoMin: 100,
        presupuestoMaximo: 50,
      });
      const p2 = calculateMultiCriteriaScore({
        paradas: [parada],
        interesesUsuario: ['Cultura'],
        tiempoTotalMin: 60,
        tiempoMaximoMin: 100,
        presupuestoMaximo: 50,
      });

      expect(p1).toEqual(p2);
    });
  });

  describe('Integración de Scoring en BEAM_SEARCH', () => {
    it('incorpora score y scoreBreakdown en los planes generados por BEAM_SEARCH', () => {
      const places = [
        createMockPlace({ id: 'p1', latitud: -12.122, longitud: -77.031 }),
        createMockPlace({ id: 'p2', latitud: -12.124, longitud: -77.032 }),
      ];
      const req = createMockRequest();

      const planes = generarPlanes(req, places, { strategy: 'BEAM_SEARCH' });
      expect(planes.length).toBeGreaterThan(0);

      for (const plan of planes) {
        expect(plan.score).toBeDefined();
        expect(plan.score).toBeGreaterThanOrEqual(0);
        expect(plan.score).toBeLessThanOrEqual(100);

        expect(plan.scoreBreakdown).toBeDefined();
        expect(plan.scoreBreakdown?.coberturaIntereses).toBeDefined();
        expect(plan.scoreBreakdown?.aprovechamientoTiempo).toBeDefined();
        expect(plan.scoreBreakdown?.compatibilidadPresupuesto).toBeDefined();
        expect(plan.scoreBreakdown?.eficienciaDesplazamiento).toBeDefined();
      }
    });

    it('conserva GREEDY sin regresiones ni alteraciones de contrato', () => {
      const places = [
        createMockPlace({ id: 'p1', latitud: -12.122, longitud: -77.031 }),
        createMockPlace({ id: 'p2', latitud: -12.124, longitud: -77.032 }),
      ];
      const req = createMockRequest();

      const planesGreedy = generarPlanes(req, places);
      expect(planesGreedy.length).toBeGreaterThan(0);
      expect(planesGreedy[0].paradas.length).toBeGreaterThan(0);
    });

    it('los planes generados por BEAM_SEARCH se serializan y deserializan limpiamente para PlansContext y resultados.tsx', () => {
      const places = [
        createMockPlace({ id: 'p1', latitud: -12.122, longitud: -77.031 }),
        createMockPlace({ id: 'p2', latitud: -12.124, longitud: -77.032 }),
      ];
      const req = createMockRequest();

      const planes = generarPlanes(req, places, { strategy: 'BEAM_SEARCH' });
      const serialized = JSON.stringify(planes);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.length).toBe(planes.length);
      expect(deserialized[0].id).toBe(planes[0].id);
      expect(deserialized[0].score).toBe(planes[0].score);
      expect(deserialized[0].scoreBreakdown).toEqual(planes[0].scoreBreakdown);
    });

    it('no emite planes ficticios ni con 0 paradas cuando no hay alternativas viables', () => {
      const lugarCostoso = createMockPlace({ gasto_max: 500 });
      const req = createMockRequest({ presupuesto: 10 });

      const planes = generarPlanes(req, [lugarCostoso], { strategy: 'BEAM_SEARCH' });
      expect(planes).toEqual([]);
      expect(planes.length).toBe(0);
    });
  });
});
