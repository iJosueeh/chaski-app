import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistanceKm,
  estimateTravelTimeMinutes,
  parseHHMMToMinutes,
  minutesToHHMM,
  addMinutesToHHMM,
  calculateTimeDifferenceMinutes,
  dateToChaskiDayOfWeek,
  determineAccessType,
  isIntervalContainingVisit,
  isPlaceAvailable,
  isBudgetViable,
  isTimeViable,
  mapInterestsToCategories,
  isPlaceMatchingInterests,
  isPlaceAlreadyVisited,
  canAddPlaceToRoute,
} from '@/features/plan-engine/viability';
import type { Place } from '@/features/places/interface/places.interface';

function createMockPlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'place-test-1',
    nombre: 'Lugar de Prueba',
    descripcion: null,
    latitud: -12.121,
    longitud: -77.03,
    direccion: 'Av. Larco 100',
    gasto_min: 10,
    gasto_max: 30,
    duracion_sugerida_min: 45,
    estado: true,
    fuente: 'test',
    external_id: null,
    tipo_disponibilidad: 'HORARIO_REGISTRADO',
    fecha_actualizacion: '2026-09-01T00:00:00Z',
    categorias: [{ id: 'cat-cultura', nombre: 'Cultura' }],
    etiquetas: [],
    horarios: [],
    ...overrides,
  };
}

describe('Módulo de Viabilidad Adaptado al Esquema Real de Supabase', () => {
  /* ── 1. Distancia Haversine ─────────────────────────────────────────────── */
  describe('calculateHaversineDistanceKm', () => {
    it('retorna 0 km para coordenadas idénticas', () => {
      expect(calculateHaversineDistanceKm(-12.121, -77.03, -12.121, -77.03)).toBe(0);
    });

    it('calcula con precisión la distancia entre puntos conocidos de Lima', () => {
      // Larcomar a Huaca Pucllana ≈ 2.43 km
      const dist = calculateHaversineDistanceKm(-12.1328, -77.0305, -12.1111, -77.0334);
      expect(dist).toBeGreaterThan(2.3);
      expect(dist).toBeLessThan(2.6);
    });

    it('es conmutativo', () => {
      const d1 = calculateHaversineDistanceKm(-12.12, -77.03, -12.15, -77.02);
      const d2 = calculateHaversineDistanceKm(-12.15, -77.02, -12.12, -77.03);
      expect(d1).toBeCloseTo(d2, 5);
    });
  });

  /* ── 2. Tiempo de Traslado ─────────────────────────────────────────────── */
  describe('estimateTravelTimeMinutes', () => {
    it('retorna 0 minutos si la distancia es 0 o negativa', () => {
      expect(estimateTravelTimeMinutes(0, 'caminando')).toBe(0);
      expect(estimateTravelTimeMinutes(-1, 'publico')).toBe(0);
    });

    it('aplica el piso mínimo de 5 minutos para distancias cortas', () => {
      expect(estimateTravelTimeMinutes(0.1, 'caminando')).toBe(5);
    });

    it('calcula traslados según la velocidad del modo seleccionado', () => {
      expect(estimateTravelTimeMinutes(9, 'caminando')).toBe(120);
      expect(estimateTravelTimeMinutes(9, 'publico')).toBe(45);
      expect(estimateTravelTimeMinutes(9, 'aplicativo')).toBe(27);
    });

    it('usa caminando como fallback cuando el modo es null o undefined', () => {
      expect(estimateTravelTimeMinutes(9, null)).toBe(120);
      expect(estimateTravelTimeMinutes(9, undefined)).toBe(120);
    });
  });

  /* ── 3. Manejo de Horas y Minutos ──────────────────────────────────────── */
  describe('Manipulación de horas y minutos', () => {
    it('parseHHMMToMinutes convierte "HH:MM" a minutos', () => {
      expect(parseHHMMToMinutes('00:00')).toBe(0);
      expect(parseHHMMToMinutes('09:15')).toBe(555);
      expect(parseHHMMToMinutes('23:59')).toBe(1439);
    });

    it('parseHHMMToMinutes admite formato con segundos "HH:MM:SS"', () => {
      expect(parseHHMMToMinutes('10:30:00')).toBe(630);
    });

    it('parseHHMMToMinutes rechaza formatos inválidos', () => {
      expect(() => parseHHMMToMinutes('25:00')).toThrow();
      expect(() => parseHHMMToMinutes('12:65')).toThrow();
    });

    it('minutesToHHMM formatea minutos a "HH:MM" con padding', () => {
      expect(minutesToHHMM(0)).toBe('00:00');
      expect(minutesToHHMM(555)).toBe('09:15');
      expect(minutesToHHMM(1440)).toBe('00:00');
    });

    it('addMinutesToHHMM suma minutos manejando cruce de medianoche', () => {
      expect(addMinutesToHHMM('10:00', 45)).toBe('10:45');
      expect(addMinutesToHHMM('23:30', 45)).toBe('00:15');
    });

    it('calculateTimeDifferenceMinutes calcula diferencias en minutos', () => {
      expect(calculateTimeDifferenceMinutes('09:00', '13:30')).toBe(270);
      expect(calculateTimeDifferenceMinutes('22:00', '01:00')).toBe(180);
    });

    it('dateToChaskiDayOfWeek convierte Date al rango 1..7 (1=Lunes, 7=Domingo)', () => {
      // 2026-10-05 fue Lunes
      const lunes = new Date(2026, 9, 5);
      expect(dateToChaskiDayOfWeek(lunes)).toBe(1);

      // 2026-10-10 es Sábado
      const sabado = new Date(2026, 9, 10);
      expect(dateToChaskiDayOfWeek(sabado)).toBe(6);

      // 2026-10-11 es Domingo (JS getDay = 0)
      const domingo = new Date(2026, 9, 11);
      expect(dateToChaskiDayOfWeek(domingo)).toBe(7);
    });
  });

  /* ── 4. Régimen Explícito de Disponibilidad (determineAccessType) ────────── */
  describe('determineAccessType (Régimen Explícito sin inferencia de categorías)', () => {
    it('utiliza el campo persistido tipo_disponibilidad = "LIBRE_ACCESO"', () => {
      // Un museo que fue marcado explícitamente como libre acceso
      const museoLibre = createMockPlace({
        categorias: [{ id: '1', nombre: 'Cultura' }],
        tipo_disponibilidad: 'LIBRE_ACCESO',
      });
      expect(determineAccessType(museoLibre)).toBe('LIBRE_ACCESO');
    });

    it('utiliza el campo persistido tipo_disponibilidad = "HORARIO_REGISTRADO"', () => {
      // Un parque que cuenta con puertas cerradas y horario registrado
      const parqueConHorario = createMockPlace({
        categorias: [{ id: '1', nombre: 'Parques' }],
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
      });
      expect(determineAccessType(parqueConHorario)).toBe('HORARIO_REGISTRADO');
    });

    it('no infiere LIBRE_ACCESO por categoría cuando falta el dato persistido', () => {
      const parqueSinDato = createMockPlace({
        categorias: [{ id: '1', nombre: 'Parques' }],
        tipo_disponibilidad: null,
      });
      // No infiere por categoría, toma el valor por defecto seguro (HORARIO_REGISTRADO)
      expect(determineAccessType(parqueSinDato)).toBe('HORARIO_REGISTRADO');
    });

    it('admite defaultAccessType configurable si no existe tipo_disponibilidad', () => {
      const lugarSinDato = createMockPlace({ tipo_disponibilidad: null });
      expect(determineAccessType(lugarSinDato, { defaultAccessType: 'LIBRE_ACCESO' })).toBe('LIBRE_ACCESO');
    });
  });

  /* ── 5. Inclusión en Intervalos (isIntervalContainingVisit) ─────────────── */
  describe('isIntervalContainingVisit (Restricción PostgreSQL y Utilidades)', () => {
    it('valida visitas en intervalos estándar de PostgreSQL (hora_cierre > hora_apertura)', () => {
      // 09:00 a 18:00
      expect(isIntervalContainingVisit('09:00', '18:00', '10:00', 60)).toBe(true);
      expect(isIntervalContainingVisit('09:00', '18:00', '17:00', 60)).toBe(true);
      expect(isIntervalContainingVisit('09:00', '18:00', '08:30', 60)).toBe(false);
      expect(isIntervalContainingVisit('09:00', '18:00', '17:30', 60)).toBe(false);
    });

    it('interpreta hora_cierre "00:00" como fin de jornada (medianoche)', () => {
      expect(isIntervalContainingVisit('18:00', '00:00', '22:00', 90)).toBe(true);
      expect(isIntervalContainingVisit('18:00', '00:00', '23:30', 45)).toBe(false);
    });

    it('soporta intervalos nocturnos cruzados como función de utilidad', () => {
      expect(isIntervalContainingVisit('21:00', '03:00', '23:00', 120)).toBe(true);
      expect(isIntervalContainingVisit('21:00', '03:00', '01:00', 60)).toBe(true);
      expect(isIntervalContainingVisit('21:00', '03:00', '02:00', 90)).toBe(false);
    });

    it('rechaza duración <= 0', () => {
      expect(isIntervalContainingVisit('09:00', '18:00', '10:00', 0)).toBe(false);
    });
  });

  /* ── 6. Disponibilidad Global y Rango de Días 1..7 (isPlaceAvailable) ─────── */
  describe('isPlaceAvailable (Rango de Días 1..7 y Disponibilidad)', () => {
    it('rechaza lugares inactivos bajo cualquier régimen', () => {
      const inactivo = createMockPlace({
        estado: false,
        tipo_disponibilidad: 'LIBRE_ACCESO',
      });
      expect(isPlaceAvailable(inactivo, { diaSemana: 1, horaLlegada: '10:00', duracionMin: 30 })).toBe(false);
    });

    it('un lugar explícito de LIBRE_ACCESO está disponible sin requerir horarios', () => {
      const malecon = createMockPlace({
        tipo_disponibilidad: 'LIBRE_ACCESO',
        horarios: [],
      });
      // Válido cualquier día de 1 a 7
      expect(isPlaceAvailable(malecon, { diaSemana: 1, horaLlegada: '10:00', duracionMin: 60 })).toBe(true);
      expect(isPlaceAvailable(malecon, { diaSemana: 7, horaLlegada: '23:00', duracionMin: 60 })).toBe(true);
    });

    it('rechaza un lugar de HORARIO_REGISTRADO si no tiene horarios registrados', () => {
      const museo = createMockPlace({
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        horarios: [],
      });
      expect(isPlaceAvailable(museo, { diaSemana: 1, horaLlegada: '10:00', duracionMin: 30 })).toBe(false);
    });

    it('respeta la convención de días 1..7: abierto Lunes (1), cerrado Martes (2) o Domingo (7)', () => {
      // Museo abierto únicamente los Lunes (dia_semana = 1)
      const museo = createMockPlace({
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        horarios: [
          { id: 'h1', dia_semana: 1, hora_apertura: '09:00', hora_cierre: '17:00' },
        ],
      });

      // Lunes (1) -> disponible
      expect(isPlaceAvailable(museo, { diaSemana: 1, horaLlegada: '10:00', duracionMin: 60 })).toBe(true);
      // Martes (2) -> no disponible
      expect(isPlaceAvailable(museo, { diaSemana: 2, horaLlegada: '10:00', duracionMin: 60 })).toBe(false);
      // Domingo (7) -> no disponible
      expect(isPlaceAvailable(museo, { diaSemana: 7, horaLlegada: '10:00', duracionMin: 60 })).toBe(false);
    });

    it('rechaza valores de diaSemana fuera del rango 1..7', () => {
      const lugar = createMockPlace({ tipo_disponibilidad: 'LIBRE_ACCESO' });
      // 0 ya no es válido en el rango 1..7
      expect(isPlaceAvailable(lugar, { diaSemana: 0, horaLlegada: '10:00', duracionMin: 30 })).toBe(false);
      // 8 excede el rango 1..7
      expect(isPlaceAvailable(lugar, { diaSemana: 8, horaLlegada: '10:00', duracionMin: 30 })).toBe(false);
      expect(isPlaceAvailable(lugar, { diaSemana: -1, horaLlegada: '10:00', duracionMin: 30 })).toBe(false);
    });

    it('soporta múltiples turnos en el mismo día (ej. Sábado dia_semana = 6)', () => {
      const restaurante = createMockPlace({
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        horarios: [
          { id: 'h1', dia_semana: 6, hora_apertura: '12:00', hora_cierre: '16:00' },
          { id: 'h2', dia_semana: 6, hora_apertura: '19:00', hora_cierre: '23:00' },
        ],
      });

      // Almuerzo en Sábado (6) -> OK
      expect(isPlaceAvailable(restaurante, { diaSemana: 6, horaLlegada: '13:00', duracionMin: 60 })).toBe(true);
      // Fuera de turno (17:00 a 18:00) -> RECHAZADO
      expect(isPlaceAvailable(restaurante, { diaSemana: 6, horaLlegada: '17:00', duracionMin: 60 })).toBe(false);
      // Cena en Sábado (6) -> OK
      expect(isPlaceAvailable(restaurante, { diaSemana: 6, horaLlegada: '20:00', duracionMin: 60 })).toBe(true);
    });

    it('rechaza una visita si la duración completa excede la hora de cierre', () => {
      const museo = createMockPlace({
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        horarios: [
          { id: 'h1', dia_semana: 5, hora_apertura: '09:00', hora_cierre: '17:00' },
        ],
      });
      // Llega a las 16:30 pero la actividad toma 60 minutos (termina 17:30 > 17:00) -> RECHAZADO
      expect(isPlaceAvailable(museo, { diaSemana: 5, horaLlegada: '16:30', duracionMin: 60 })).toBe(false);
    });
  });

  /* ── 7. Restricciones Acumuladas de Presupuesto y Tiempo ────────────────── */
  describe('Validación de presupuesto y tiempo acumulado', () => {
    it('isBudgetViable valida el límite de presupuesto', () => {
      expect(isBudgetViable(50, 20, 100)).toBe(true);
      expect(isBudgetViable(80, 20, 100)).toBe(true);
      expect(isBudgetViable(85, 20, 100)).toBe(false);
    });

    it('isTimeViable valida el límite de tiempo total acumulado', () => {
      expect(isTimeViable(120, 15, 45, 240)).toBe(true);
      expect(isTimeViable(120, 15, 45, 180)).toBe(true);
      expect(isTimeViable(120, 15, 45, 175)).toBe(false);
    });
  });

  /* ── 8. Categorías e Intereses ─────────────────────────────────────────── */
  describe('Categorías e Intereses', () => {
    it('mapInterestsToCategories mapea correctamente', () => {
      expect(mapInterestsToCategories([])).toBeNull();
      expect(mapInterestsToCategories(['Cultura'])).toEqual(['Cultura']);
      expect(mapInterestsToCategories(['Naturaleza'])).toEqual(['Parques', 'Miradores']);
    });

    it('isPlaceMatchingInterests aprueba cualquier lugar si no hay intereses', () => {
      const lugar = createMockPlace({ categorias: [{ id: '1', nombre: 'Gastronomía' }] });
      expect(isPlaceMatchingInterests(lugar, [])).toBe(true);
    });

    it('isPlaceMatchingInterests filtra adecuadamente según las categorías del lugar', () => {
      const museo = createMockPlace({ categorias: [{ id: '1', nombre: 'Cultura' }] });
      const parque = createMockPlace({ categorias: [{ id: '2', nombre: 'Parques' }] });

      expect(isPlaceMatchingInterests(museo, ['Cultura'])).toBe(true);
      expect(isPlaceMatchingInterests(parque, ['Cultura'])).toBe(false);
      expect(isPlaceMatchingInterests(parque, ['Naturaleza'])).toBe(true);
    });
  });

  /* ── 9. Control de Lugares Repetidos ────────────────────────────────────── */
  describe('Control de duplicados en la ruta', () => {
    it('detecta si un lugar ya fue visitado en Set o Array', () => {
      const visitadosSet = new Set(['place-1', 'place-2']);
      expect(isPlaceAlreadyVisited('place-1', visitadosSet)).toBe(true);
      expect(isPlaceAlreadyVisited('place-3', visitadosSet)).toBe(false);
    });

    it('canAddPlaceToRoute permite agregar solo si no está en la ruta', () => {
      const ruta = new Set(['p1', 'p2']);
      expect(canAddPlaceToRoute('p3', ruta)).toBe(true);
      expect(canAddPlaceToRoute('p1', ruta)).toBe(false);
    });
  });
});
