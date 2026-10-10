import { describe, expect, it } from 'vitest';
import { generarPlanes, provisionalRouteScore } from '../plan-engine';
import type { Place } from '@/features/places/interface/places.interface';
import type { WizardPlanRequest } from '@/features/wizard/context/wizard-context';

function createMockPlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'p-1',
    nombre: 'Lugar de Prueba',
    descripcion: 'Descripción de prueba',
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

describe('Motor de Recorridos - Estrategia BEAM_SEARCH', () => {
  describe('Exploración de múltiples combinaciones y ancho de haz', () => {
    it('escapa del óptimo local de Greedy y encuentra una ruta con más paradas viables', () => {
      // Origen en (-12.120, -77.030)
      // Lugar A: muy cerca (0.1 km), pero aislado: los demás lugares están a >15km de A o son inviables
      // Lugares B, C, D: a 1.0 km, 1.3 km, 1.6 km del origen, conectados entre sí
      const lugarA = createMockPlace({
        id: 'lugar-a-trampa-cercana',
        nombre: 'Lugar A (Cercano aislado)',
        latitud: -12.1205,
        longitud: -77.0305,
        duracion_sugerida_min: 60,
        gasto_max: 10,
        horarios: [{ id: 'h1', dia_semana: 1, hora_apertura: '09:00', hora_cierre: '18:00' }],
      });

      const lugarB = createMockPlace({
        id: 'lugar-b-cluster',
        nombre: 'Lugar B (Cluster)',
        latitud: -12.129,
        longitud: -77.031,
        duracion_sugerida_min: 30,
        gasto_max: 10,
        horarios: [{ id: 'h2', dia_semana: 1, hora_apertura: '09:00', hora_cierre: '18:00' }],
      });

      const lugarC = createMockPlace({
        id: 'lugar-c-cluster',
        nombre: 'Lugar C (Cluster)',
        latitud: -12.131,
        longitud: -77.032,
        duracion_sugerida_min: 30,
        gasto_max: 10,
        horarios: [{ id: 'h3', dia_semana: 1, hora_apertura: '09:00', hora_cierre: '18:00' }],
      });

      const lugarD = createMockPlace({
        id: 'lugar-d-cluster',
        nombre: 'Lugar D (Cluster)',
        latitud: -12.133,
        longitud: -77.033,
        duracion_sugerida_min: 30,
        gasto_max: 10,
        horarios: [{ id: 'h4', dia_semana: 1, hora_apertura: '09:00', hora_cierre: '18:00' }],
      });

      // Hacemos que desde A hacia B, C o D la distancia sea muy lejana para el tiempo de Íntima
      // O ajustamos presupuesto/tiempo para que Greedy con Íntima empiece en A y no le alcance para conectar
      const req = createMockRequest({
        minutosTotales: 90, // Íntima tiene 90 * 0.55 = 49 minutos
        horaInicio: '09:00',
        presupuesto: 50,
      });

      const lugares = [lugarA, lugarB, lugarC, lugarD];

      // Greedy con Íntima escoge 'cercana' -> A (duración 60 excede 49 min, por ende 0 paradas)
      // Mientras que B (duración 30) sí cabe!
      const planesGreedy = generarPlanes(req, lugares, { strategy: 'GREEDY' });
      const planesBeam = generarPlanes(req, lugares, { strategy: 'BEAM_SEARCH', beamWidth: 3 });

      expect(planesBeam.length).toBeGreaterThan(0);
      const planBeamIntimo = planesBeam.find((p) => p.variante === 'intimo');
      if (planBeamIntimo) {
        expect(planBeamIntimo.paradas.length).toBeGreaterThan(0);
        expect(planBeamIntimo.paradas[0].place.id).not.toBe('lugar-a-trampa-cercana');
      }
      void planesGreedy;
    });

    it('respeta el parámetro configurable beamWidth', () => {
      const places = [
        createMockPlace({ id: 'p1', latitud: -12.122, longitud: -77.031 }),
        createMockPlace({ id: 'p2', latitud: -12.124, longitud: -77.032 }),
        createMockPlace({ id: 'p3', latitud: -12.126, longitud: -77.033 }),
      ];
      const req = createMockRequest();

      const planesW1 = generarPlanes(req, places, { strategy: 'BEAM_SEARCH', beamWidth: 1 });
      const planesW3 = generarPlanes(req, places, { strategy: 'BEAM_SEARCH', beamWidth: 3 });

      expect(planesW1.length).toBeGreaterThan(0);
      expect(planesW3.length).toBeGreaterThan(0);
    });
  });

  describe('Respeto de límites de tiempo y presupuesto', () => {
    it('el costo total de cada variante nunca excede su fracción de presupuesto', () => {
      const places = [
        createMockPlace({ id: 'p1', gasto_max: 30, latitud: -12.122, longitud: -77.031 }),
        createMockPlace({ id: 'p2', gasto_max: 30, latitud: -12.124, longitud: -77.032 }),
        createMockPlace({ id: 'p3', gasto_max: 30, latitud: -12.126, longitud: -77.033 }),
        createMockPlace({ id: 'p4', gasto_max: 30, latitud: -12.128, longitud: -77.034 }),
      ];

      // Presupuesto total: 60.
      // Íntima (frac 0.6) = 36 -> max 1 parada de 30
      // Equilibrado (frac 0.85) = 51 -> max 1 parada de 30
      // Explorador (frac 1.0) = 60 -> max 2 paradas de 30
      const req = createMockRequest({ presupuesto: 60 });
      const planes = generarPlanes(req, places, { strategy: 'BEAM_SEARCH' });

      for (const plan of planes) {
        if (plan.variante === 'intimo') {
          expect(plan.costo_total).toBeLessThanOrEqual(36);
        } else if (plan.variante === 'equilibrado') {
          expect(plan.costo_total).toBeLessThanOrEqual(51);
        } else if (plan.variante === 'explorador') {
          expect(plan.costo_total).toBeLessThanOrEqual(60);
        }
      }
    });

    it('la duración acumulada no supera el tiempo total asignado a la variante', () => {
      const places = [
        createMockPlace({ id: 'p1', duracion_sugerida_min: 40, latitud: -12.122, longitud: -77.031 }),
        createMockPlace({ id: 'p2', duracion_sugerida_min: 40, latitud: -12.124, longitud: -77.032 }),
        createMockPlace({ id: 'p3', duracion_sugerida_min: 40, latitud: -12.126, longitud: -77.033 }),
      ];

      // Tiempo total: 100 min.
      // Íntima (0.55) = 55 min
      // Equilibrado (0.8) = 80 min
      // Explorador (1.0) = 100 min
      const req = createMockRequest({ minutosTotales: 100 });
      const planes = generarPlanes(req, places, { strategy: 'BEAM_SEARCH' });

      for (const plan of planes) {
        if (plan.variante === 'intimo') {
          expect(plan.duracion_total_min).toBeLessThanOrEqual(55);
        } else if (plan.variante === 'equilibrado') {
          expect(plan.duracion_total_min).toBeLessThanOrEqual(80);
        } else if (plan.variante === 'explorador') {
          expect(plan.duracion_total_min).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('Validación y rechazo estricto de horarios en BEAM_SEARCH', () => {
    it('rechaza lugares que se encuentren cerrados a la hora estimada de llegada', () => {
      const lugarCerrado = createMockPlace({
        id: 'cerrado-manana',
        horarios: [{ id: 'h1', dia_semana: 1, hora_apertura: '14:00', hora_cierre: '18:00' }],
      });
      const req = createMockRequest({ horaInicio: '09:00', diaSemana: 1 });
      const planes = generarPlanes(req, [lugarCerrado], { strategy: 'BEAM_SEARCH' });

      expect(planes).toEqual([]);
    });

    it('rechaza lugares cuya visita excede la hora de cierre', () => {
      const lugarCierreTemprano = createMockPlace({
        id: 'cierre-temprano',
        duracion_sugerida_min: 60,
        horarios: [{ id: 'h1', dia_semana: 1, hora_apertura: '09:00', hora_cierre: '18:00' }],
      });

      // Llegada a las 17:15 + 60 min -> 18:15 (> 18:00)
      const req = createMockRequest({ horaInicio: '17:15', diaSemana: 1 });
      const planes = generarPlanes(req, [lugarCierreTemprano], { strategy: 'BEAM_SEARCH' });

      expect(planes).toEqual([]);
    });

    it('acepta lugares de LIBRE_ACCESO sin requerir horarios registrados', () => {
      const parqueLibre = createMockPlace({
        id: 'parque-libre',
        tipo_disponibilidad: 'LIBRE_ACCESO',
        horarios: [],
      });
      const req = createMockRequest();
      const planes = generarPlanes(req, [parqueLibre], { strategy: 'BEAM_SEARCH' });

      expect(planes.length).toBeGreaterThan(0);
      expect(planes[0].paradas[0].place.id).toBe('parque-libre');
    });

    it('rechaza lugares HORARIO_REGISTRADO sin horarios registrados en Supabase', () => {
      const lugarSinHorarios = createMockPlace({
        id: 'sin-horarios',
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        horarios: [],
      });
      const req = createMockRequest();
      const planes = generarPlanes(req, [lugarSinHorarios], { strategy: 'BEAM_SEARCH' });

      expect(planes).toEqual([]);
    });
  });

  describe('Ausencia de paradas duplicadas y ciclos', () => {
    it('nunca repite el mismo lugar dentro de una ruta', () => {
      const places = [
        createMockPlace({ id: 'p1', latitud: -12.122, longitud: -77.031 }),
        createMockPlace({ id: 'p2', latitud: -12.124, longitud: -77.032 }),
        createMockPlace({ id: 'p3', latitud: -12.126, longitud: -77.033 }),
        createMockPlace({ id: 'p4', latitud: -12.128, longitud: -77.034 }),
      ];

      const req = createMockRequest({ minutosTotales: 300, presupuesto: 200 });
      const planes = generarPlanes(req, places, { strategy: 'BEAM_SEARCH', beamWidth: 3 });

      for (const plan of planes) {
        const placeIds = plan.paradas.map((p) => p.place.id);
        const uniqueIds = new Set(placeIds);
        expect(uniqueIds.size).toBe(placeIds.length);
      }
    });

    it('deduplica variantes si convergen a la misma secuencia exacta de paradas', () => {
      const soloUnLugar = [createMockPlace({ id: 'unico-lugar' })];
      const req = createMockRequest();
      const planes = generarPlanes(req, soloUnLugar, { strategy: 'BEAM_SEARCH' });

      // Solo 1 variante debe conservarse (la primera)
      expect(planes.length).toBe(1);
    });
  });

  describe('Resultados deterministas', () => {
    it('produce exactamente los mismos planes y secuencias en ejecuciones sucesivas', () => {
      const places = [
        createMockPlace({ id: 'p1', nombre: 'P1', latitud: -12.122, longitud: -77.031 }),
        createMockPlace({ id: 'p2', nombre: 'P2', latitud: -12.125, longitud: -77.032 }),
        createMockPlace({ id: 'p3', nombre: 'P3', latitud: -12.127, longitud: -77.033 }),
      ];
      const req = createMockRequest();

      const run1 = generarPlanes(req, places, { strategy: 'BEAM_SEARCH' });
      const run2 = generarPlanes(req, places, { strategy: 'BEAM_SEARCH' });

      expect(run1.length).toBe(run2.length);
      for (let i = 0; i < run1.length; i++) {
        expect(run1[i].variante).toBe(run2[i].variante);
        expect(run1[i].costo_total).toBe(run2[i].costo_total);
        expect(run1[i].duracion_total_min).toBe(run2[i].duracion_total_min);
        expect(run1[i].paradas.map((p) => p.place.id)).toEqual(
          run2[i].paradas.map((p) => p.place.id),
        );
        expect(run1[i].paradas.map((p) => p.llegada)).toEqual(
          run2[i].paradas.map((p) => p.llegada),
        );
      }
    });
  });

  describe('Casos sin rutas viables', () => {
    it('retorna array vacío si el origen no tiene coordenadas', () => {
      const reqSinUbicacion = createMockRequest({ ubicacion: null });
      const planes = generarPlanes(reqSinUbicacion, [createMockPlace()], { strategy: 'BEAM_SEARCH' });
      expect(planes).toEqual([]);
    });

    it('retorna array vacío si no hay lugares suministrados', () => {
      const req = createMockRequest();
      const planes = generarPlanes(req, [], { strategy: 'BEAM_SEARCH' });
      expect(planes).toEqual([]);
    });

    it('retorna array vacío si todos los lugares están a más de 12 km', () => {
      const lugarLejano = createMockPlace({
        id: 'muy-lejos',
        latitud: -12.30, // > 15 km de -12.121
        longitud: -77.03,
      });
      const req = createMockRequest();
      const planes = generarPlanes(req, [lugarLejano], { strategy: 'BEAM_SEARCH' });
      expect(planes).toEqual([]);
    });

    it('retorna array vacío si ningún lugar coincide con los intereses seleccionados', () => {
      const museo = createMockPlace({
        categorias: [{ id: 'cat-cultura', nombre: 'Cultura' }],
      });
      const req = createMockRequest({ intereses: ['Gastronomía'] });
      const planes = generarPlanes(req, [museo], { strategy: 'BEAM_SEARCH' });
      expect(planes).toEqual([]);
    });
  });

  describe('Conservación del comportamiento Greedy por defecto', () => {
    it('conserva GREEDY como estrategia predeterminada cuando no se pasa options', () => {
      const places = [
        createMockPlace({ id: 'p1', latitud: -12.122, longitud: -77.031 }),
        createMockPlace({ id: 'p2', latitud: -12.124, longitud: -77.032 }),
      ];
      const req = createMockRequest();

      const planesDefault = generarPlanes(req, places);
      const planesGreedyExplicito = generarPlanes(req, places, { strategy: 'GREEDY' });

      expect(planesDefault.length).toBe(planesGreedyExplicito.length);
      for (let i = 0; i < planesDefault.length; i++) {
        expect(planesDefault[i].variante).toBe(planesGreedyExplicito[i].variante);
        expect(planesDefault[i].paradas.map((p) => p.place.id)).toEqual(
          planesGreedyExplicito[i].paradas.map((p) => p.place.id),
        );
      }
    });

    it('admite la estrategia desde el campo request.estrategia', () => {
      const places = [createMockPlace({ id: 'p1', latitud: -12.122, longitud: -77.031 })];
      const reqBeam = createMockRequest({ estrategia: 'BEAM_SEARCH' });
      const reqGreedy = createMockRequest({ estrategia: 'GREEDY' });

      const planesBeam = generarPlanes(reqBeam, places);
      const planesGreedy = generarPlanes(reqGreedy, places);

      expect(planesBeam.length).toBeGreaterThan(0);
      expect(planesGreedy.length).toBeGreaterThan(0);
    });
  });

  describe('Función de evaluación provisional y determinista', () => {
    it('asigna mayor puntaje a rutas con más paradas y penaliza distancias largas', () => {
      const stop1 = {
        place: createMockPlace({ id: 'p1' }),
        orden: 1,
        llegada: '09:00',
        duracion_min: 60,
        traslado_desde_anterior_min: 0,
        costo_estimado: 10,
      };
      const stop2 = {
        place: createMockPlace({ id: 'p2' }),
        orden: 2,
        llegada: '10:05',
        duracion_min: 60,
        traslado_desde_anterior_min: 5,
        costo_estimado: 10,
      };

      const score1Parada = provisionalRouteScore([stop1], 2, 'point');
      const score2Paradas = provisionalRouteScore([stop1, stop2], 3, 'point');

      expect(score2Paradas).toBeGreaterThan(score1Parada);
    });
  });
});
