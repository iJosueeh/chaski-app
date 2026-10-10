import { describe, it, expect } from 'vitest';
import { generarPlanes } from '@/features/plan-engine/plan-engine';
import type { Place } from '@/features/places/interface/places.interface';
import type { WizardPlanRequest } from '@/features/wizard/context/wizard-context';

function createMockPlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'place-1',
    nombre: 'Lugar de Prueba',
    descripcion: 'Descripción de prueba',
    latitud: -12.121,
    longitud: -77.03,
    direccion: 'Av. Larco 100',
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

describe('Motor Greedy - Pruebas de Caracterización (Comportamiento Actual)', () => {
  describe('Validación de entradas y casos límite', () => {
    it('retorna array vacío si la ubicación de origen no está definida o no tiene latitud/longitud', () => {
      const reqSinUbicacion = createMockRequest({ ubicacion: null });
      const reqSinCoord = createMockRequest({
        ubicacion: { modo: 'gps', nombre: 'Test', lat: null, lng: null },
      });
      const places = [createMockPlace()];

      expect(generarPlanes(reqSinUbicacion, places)).toEqual([]);
      expect(generarPlanes(reqSinCoord, places)).toEqual([]);
    });

    it('retorna array vacío si no hay lugares suministrados', () => {
      const req = createMockRequest();
      expect(generarPlanes(req, [])).toEqual([]);
    });

    it('descarta lugares situados a más de 12 km del origen', () => {
      const req = createMockRequest({
        ubicacion: { modo: 'gps', nombre: 'Miraflores', lat: -12.121, lng: -77.03 },
      });
      // Coordenadas a más de 20 km (ej. Ancón o Chosica)
      const lugarLejano = createMockPlace({
        id: 'far-away',
        latitud: -11.77,
        longitud: -77.17,
      });

      const planes = generarPlanes(req, [lugarLejano]);
      expect(planes).toEqual([]);
    });

    it('retorna array vacío si el filtro de intereses no coincide con ninguna categoría', () => {
      const req = createMockRequest({ intereses: ['Gastronomía'] });
      const lugarCultura = createMockPlace({
        categorias: [{ id: 'c1', nombre: 'Cultura' }],
      });

      const planes = generarPlanes(req, [lugarCultura]);
      expect(planes).toEqual([]);
    });

    it('retorna array vacío si el costo mínimo excede la fracción de presupuesto de las variantes', () => {
      // Presupuesto total = 10, pero la variante más baja ('intimo') usa 60% = 6
      const req = createMockRequest({ presupuesto: 5 });
      const lugarCostoso = createMockPlace({ gasto_max: 50 });

      const planes = generarPlanes(req, [lugarCostoso]);
      expect(planes).toEqual([]);
    });
  });

  describe('Filtro y mapeo de intereses', () => {
    it('incluye todos los lugares en radio cuando intereses está vacío', () => {
      const req = createMockRequest({ intereses: [] });
      const l1 = createMockPlace({ id: 'p1', categorias: [{ id: 'c1', nombre: 'Cultura' }] });
      const l2 = createMockPlace({ id: 'p2', categorias: [{ id: 'c2', nombre: 'Gastronomía' }] });

      const planes = generarPlanes(req, [l1, l2]);
      expect(planes.length).toBeGreaterThan(0);
      const lugaresEnPlanes = planes.flatMap((p) => p.paradas.map((s) => s.place.id));
      expect(lugaresEnPlanes).toContain('p1');
      expect(lugaresEnPlanes).toContain('p2');
    });

    it('mapea "Naturaleza" a categorías "Parques" y "Miradores"', () => {
      const req = createMockRequest({ intereses: ['Naturaleza'] });
      const lParque = createMockPlace({
        id: 'parque',
        categorias: [{ id: 'cat-p', nombre: 'Parques' }],
      });
      const lCultura = createMockPlace({
        id: 'cultura',
        categorias: [{ id: 'cat-c', nombre: 'Cultura' }],
      });

      const planes = generarPlanes(req, [lParque, lCultura]);
      expect(planes.length).toBeGreaterThan(0);
      for (const plan of planes) {
        const ids = plan.paradas.map((s) => s.place.id);
        expect(ids).toContain('parque');
        expect(ids).not.toContain('cultura');
      }
    });

    it('mapea "Historia" a categorías "Historia" y "Cultura"', () => {
      const req = createMockRequest({ intereses: ['Historia'] });
      const lCultura = createMockPlace({
        id: 'cultura',
        categorias: [{ id: 'cat-c', nombre: 'Cultura' }],
      });
      const planes = generarPlanes(req, [lCultura]);
      expect(planes.length).toBeGreaterThan(0);
      expect(planes[0].paradas[0].place.id).toBe('cultura');
    });
  });

  describe('Generación de variantes y límites de paradas', () => {
    const catalogo = [
      createMockPlace({ id: 'l1', latitud: -12.1215, longitud: -77.0305, gasto_max: 5, duracion_sugerida_min: 30 }),
      createMockPlace({ id: 'l2', latitud: -12.1230, longitud: -77.0310, gasto_max: 5, duracion_sugerida_min: 30 }),
      createMockPlace({ id: 'l3', latitud: -12.1250, longitud: -77.0320, gasto_max: 5, duracion_sugerida_min: 30 }),
      createMockPlace({ id: 'l4', latitud: -12.1270, longitud: -77.0330, gasto_max: 5, duracion_sugerida_min: 30 }),
      createMockPlace({ id: 'l5', latitud: -12.1290, longitud: -77.0340, gasto_max: 5, duracion_sugerida_min: 30 }),
      createMockPlace({ id: 'l6', latitud: -12.1310, longitud: -77.0350, gasto_max: 5, duracion_sugerida_min: 30 }),
    ];

    it('genera hasta 3 variantes distintas respetando maxStops por variante', () => {
      const req = createMockRequest({ minutosTotales: 360, presupuesto: 200 });
      const planes = generarPlanes(req, catalogo);

      expect(planes.length).toBeLessThanOrEqual(3);
      expect(planes.length).toBeGreaterThanOrEqual(1);

      const intimo = planes.find((p) => p.variante === 'intimo');
      const equilibrado = planes.find((p) => p.variante === 'equilibrado');
      const explorador = planes.find((p) => p.variante === 'explorador');

      if (intimo) expect(intimo.paradas.length).toBeLessThanOrEqual(3);
      if (equilibrado) expect(equilibrado.paradas.length).toBeLessThanOrEqual(4);
      if (explorador) expect(explorador.paradas.length).toBeLessThanOrEqual(5);
    });

    it('deduplica variantes si dos generan exactamente la misma secuencia de paradas', () => {
      // Con un único lugar disponible, todas las variantes convergerían a [l1]
      const unSoloLugar = [catalogo[0]];
      const req = createMockRequest({ minutosTotales: 300, presupuesto: 100 });
      const planes = generarPlanes(req, unSoloLugar);

      // El filtro de deduplicación asegura que solo quede 1 plan único
      expect(planes.length).toBe(1);
    });

    it('asigna la primera parada (ancla) según la estrategia de la variante', () => {
      const req = createMockRequest({ minutosTotales: 360, presupuesto: 200 });
      const planes = generarPlanes(req, catalogo);

      const intimo = planes.find((p) => p.variante === 'intimo');
      const explorador = planes.find((p) => p.variante === 'explorador');

      // 'intimo' arranca en la parada más cercana (ancla cercana = l1)
      if (intimo) {
        expect(intimo.paradas[0].place.id).toBe('l1');
      }
      // 'explorador' arranca en la viable más lejana
      if (explorador && intimo) {
        expect(explorador.paradas[0].place.id).not.toBe(intimo.paradas[0].place.id);
      }
    });
  });

  describe('Restricciones de presupuesto y tiempo acumulado', () => {
    it('el costo total y los costos individuales nunca exceden el presupuesto asignado', () => {
      const catalogo = [
        createMockPlace({ id: 'a', latitud: -12.1211, longitud: -77.0301, gasto_max: 20 }),
        createMockPlace({ id: 'b', latitud: -12.1221, longitud: -77.0302, gasto_max: 20 }),
        createMockPlace({ id: 'c', latitud: -12.1231, longitud: -77.0303, gasto_max: 20 }),
      ];

      const req = createMockRequest({ presupuesto: 40 });
      const planes = generarPlanes(req, catalogo);

      for (const plan of planes) {
        expect(plan.costo_total).toBeLessThanOrEqual(40);
        const sumaCalculada = plan.paradas.reduce((sum, p) => sum + p.costo_estimado, 0);
        expect(plan.costo_total).toBe(sumaCalculada);
      }
    });

    it('la duración acumulada no supera el tiempo total asignado a la variante', () => {
      const catalogo = [
        createMockPlace({ id: 'a', latitud: -12.1211, longitud: -77.0301, duracion_sugerida_min: 60 }),
        createMockPlace({ id: 'b', latitud: -12.1221, longitud: -77.0302, duracion_sugerida_min: 60 }),
        createMockPlace({ id: 'c', latitud: -12.1231, longitud: -77.0303, duracion_sugerida_min: 60 }),
      ];

      const req = createMockRequest({ minutosTotales: 150 });
      const planes = generarPlanes(req, catalogo);

      for (const plan of planes) {
        expect(plan.duracion_total_min).toBeLessThanOrEqual(150);
      }
    });
  });

  describe('Cálculo de traslados y movilidad', () => {
    it('aplica al menos 5 minutos como tiempo mínimo de traslado entre paradas', () => {
      // Dos lugares casi en las mismas coordenadas exactas
      const catalogo = [
        createMockPlace({ id: 'cercano-1', latitud: -12.121001, longitud: -77.030001 }),
        createMockPlace({ id: 'cercano-2', latitud: -12.121002, longitud: -77.030002 }),
      ];

      const req = createMockRequest();
      const planes = generarPlanes(req, catalogo);

      expect(planes.length).toBeGreaterThan(0);
      for (const stop of planes[0].paradas) {
        expect(stop.traslado_desde_anterior_min).toBeGreaterThanOrEqual(5);
      }
    });

    it('calcula horas de llegada consecutivas partiendo de horaInicio', () => {
      const catalogo = [
        createMockPlace({ id: 'p1', latitud: -12.1215, longitud: -77.0305, duracion_sugerida_min: 30 }),
        createMockPlace({ id: 'p2', latitud: -12.1235, longitud: -77.0315, duracion_sugerida_min: 45 }),
      ];

      const req = createMockRequest({ horaInicio: '10:00' });
      const planes = generarPlanes(req, catalogo);

      const plan = planes[0];
      expect(plan.paradas.length).toBeGreaterThan(0);
      expect(plan.paradas[0].llegada).toBe('10:05'); // 10:00 + min 5 min de traslado
    });

    it('calcula traslados más rápidos para movilidad aplicativo que caminando', () => {
      // Lugar a ~3 km de distancia
      const lugar = [
        createMockPlace({ id: 'medio', latitud: -12.148, longitud: -77.030, duracion_sugerida_min: 30 }),
      ];

      const reqCaminando = createMockRequest({ movilidad: 'caminando', minutosTotales: 300 });
      const reqAuto = createMockRequest({ movilidad: 'aplicativo', minutosTotales: 300 });

      const planesCaminando = generarPlanes(reqCaminando, lugar);
      const planesAuto = generarPlanes(reqAuto, lugar);

      expect(planesCaminando.length).toBeGreaterThan(0);
      expect(planesAuto.length).toBeGreaterThan(0);

      const tCaminando = planesCaminando[0].paradas[0].traslado_desde_anterior_min;
      const tAuto = planesAuto[0].paradas[0].traslado_desde_anterior_min;

      expect(tAuto).toBeLessThan(tCaminando);
    });
  });

  describe('Validación de disponibilidad y horarios en el motor Greedy', () => {
    it('rechaza lugares cerrados a la hora estimada de llegada', () => {
      // El lugar cierra a las 11:00, pero el plan arranca a las 14:00
      const lugarCerrado = createMockPlace({
        id: 'cerrado',
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        horarios: [
          { id: 'h1', dia_semana: 1, hora_apertura: '08:00', hora_cierre: '11:00' },
        ],
      });

      const reqTarde = createMockRequest({ horaInicio: '14:00', diaSemana: 1 });
      const planes = generarPlanes(reqTarde, [lugarCerrado]);

      // Debe rechazar el lugar cerrado y no retornar ningún plan
      expect(planes).toEqual([]);
    });

    it('rechaza lugares que no abren en el día de la semana solicitado', () => {
      // Abierto solo los martes (dia_semana: 2), solicitud en lunes (dia_semana: 1)
      const lugarMartes = createMockPlace({
        id: 'martes-only',
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        horarios: [
          { id: 'h1', dia_semana: 2, hora_apertura: '09:00', hora_cierre: '18:00' },
        ],
      });

      const reqLunes = createMockRequest({ diaSemana: 1 });
      const planes = generarPlanes(reqLunes, [lugarMartes]);
      expect(planes).toEqual([]);
    });

    it('acepta lugares de LIBRE_ACCESO sin requerir horarios registrados', () => {
      const malecon = createMockPlace({
        id: 'malecon',
        tipo_disponibilidad: 'LIBRE_ACCESO',
        horarios: [],
      });

      const req = createMockRequest({ diaSemana: 1, horaInicio: '10:00' });
      const planes = generarPlanes(req, [malecon]);
      expect(planes.length).toBeGreaterThan(0);
      expect(planes[0].paradas[0].place.id).toBe('malecon');
    });

    it('rechaza lugares de HORARIO_REGISTRADO que no tienen ningún horario registrado', () => {
      const museoSinHorarios = createMockPlace({
        id: 'sin-horarios',
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        horarios: [],
      });

      const req = createMockRequest({ diaSemana: 1 });
      const planes = generarPlanes(req, [museoSinHorarios]);
      expect(planes).toEqual([]);
    });

    it('rechaza un lugar si la duración completa de la visita excede la hora de cierre', () => {
      // Si la visita dura 60 min y el lugar cierra a las 18:00, iniciar a las 17:15 hace que finalice a las 18:15 (> 18:00)
      const museoCierreTemprano = createMockPlace({
        id: 'cierre-temprano',
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        duracion_sugerida_min: 60,
        horarios: [
          { id: 'h1', dia_semana: 1, hora_apertura: '09:00', hora_cierre: '18:00' },
        ],
      });

      const req = createMockRequest({ horaInicio: '17:15', diaSemana: 1 });
      const planes = generarPlanes(req, [museoCierreTemprano]);
      expect(planes).toEqual([]);
    });

    it('si un candidato no es viable por horario, continúa evaluando y selecciona el siguiente viable', () => {
      const lugarCerradoCercano = createMockPlace({
        id: 'cerrado-cerca',
        latitud: -12.1211,
        longitud: -77.0301,
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        horarios: [
          { id: 'h1', dia_semana: 1, hora_apertura: '06:00', hora_cierre: '08:00' }, // Cerrado a las 10:00
        ],
      });

      const lugarAbiertoLejano = createMockPlace({
        id: 'abierto-lejos',
        latitud: -12.1250,
        longitud: -77.0320,
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        horarios: [
          { id: 'h2', dia_semana: 1, hora_apertura: '09:00', hora_cierre: '18:00' }, // Abierto
        ],
      });

      const req = createMockRequest({ horaInicio: '10:00', diaSemana: 1 });
      const planes = generarPlanes(req, [lugarCerradoCercano, lugarAbiertoLejano]);

      expect(planes.length).toBeGreaterThan(0);
      expect(planes[0].paradas[0].place.id).toBe('abierto-lejos');
    });

    it('itinerario que cruza medianoche evalúa la disponibilidad del día siguiente', () => {
      // Plan arranca a las 23:45 del Lunes (dia_semana: 1).
      // Traslado a lugar a 2.1 km -> ~28 min -> llegada 00:13 del Martes (dia_semana: 2).
      const clubNocturno = createMockPlace({
        id: 'club-martes',
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        duracion_sugerida_min: 60,
        latitud: -12.14,
        longitud: -77.03,
        horarios: [
          // En Martes (dia 2) abierto de 00:00 a 05:00
          { id: 'h1', dia_semana: 2, hora_apertura: '00:00', hora_cierre: '05:00' },
        ],
      });

      const reqNoche = createMockRequest({
        horaInicio: '23:45',
        diaSemana: 1,
        movilidad: 'caminando',
        minutosTotales: 180,
      });

      const planes = generarPlanes(reqNoche, [clubNocturno]);
      expect(planes.length).toBeGreaterThan(0);
      expect(planes[0].paradas[0].place.id).toBe('club-martes');
      expect(planes[0].paradas[0].llegada.startsWith('00:')).toBe(true);
    });
  });
});
