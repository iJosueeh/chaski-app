/**
 * Módulo de validación de viabilidad para el motor de recorridos Chaski.
 *
 * Contiene funciones puras y tipadas para:
 * 1. Distancias geográficas (Haversine).
 * 2. Tiempos de traslado según movilidad.
 * 3. Manipulación consistente de horas y minutos ("HH:MM").
 * 4. Disponibilidad horaria y régimen de acceso explícito (LIBRE_ACCESO vs HORARIO_REGISTRADO).
 * 5. Restricciones acumuladas de presupuesto y tiempo.
 * 6. Compatibilidad con categorías e intereses.
 * 7. Control de duplicados en la ruta.
 *
 * Convenciones de Base de Datos (confirmadas en Supabase PostgreSQL):
 * - `lugares.tipo_disponibilidad`: TEXT ('LIBRE_ACCESO' | 'HORARIO_REGISTRADO').
 * - `horarios_lugar.dia_semana`: 1..7 (1 = Lunes, ..., 7 = Domingo, según ISO-8601 y schedule-display).
 * - `horarios_lugar`: Restricción CHECK de PostgreSQL exige `hora_cierre > hora_apertura`.
 */

import type { Place } from '@/features/places/interface/places.interface';

/* ── Tipos y constantes ─────────────────────────────────────────────────── */

export type MobilityMode = 'caminando' | 'publico' | 'aplicativo';

export type AccessType = 'LIBRE_ACCESO' | 'HORARIO_REGISTRADO';

export const VELOCIDADES_KMH: Record<MobilityMode, number> = {
  caminando: 4.5,
  publico: 12,
  aplicativo: 20,
};

export const TIEMPO_MINIMO_TRASLADO_MIN = 5;

/** Mapeo oficial de intereses del Wizard hacia nombres de categorías de la BD. */
export const MAPA_INTERESES_CATEGORIAS: Record<string, string[]> = {
  'Gastronomía': ['Gastronomía'],
  'Cultura': ['Cultura'],
  'Naturaleza': ['Parques', 'Miradores'],
  'Historia': ['Historia', 'Cultura'],
  'Compras': [],
  'Nocturno': [],
};

/**
 * Nombres canónicos de los días de la semana según la convención 1..7 de Chaski / Supabase.
 * Alineado con ISO-8601 (ISODOW) y con la implementación de ScheduleDisplay.
 */
export const DIAS_SEMANA_CHASKI: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

/* ── 1. Distancia Geográfica (Haversine) ─────────────────────────────────── */

/**
 * Calcula la distancia ortodrómica en kilómetros entre dos coordenadas usando la fórmula de Haversine.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }
  const R = 6371; // Radio medio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ── 2. Tiempo de Traslado ──────────────────────────────────────────────── */

/**
 * Estima los minutos de traslado entre 2 puntos dada la distancia y el modo de movilidad.
 * Respeta el piso mínimo de 5 minutos por defecto si la distancia es positiva.
 */
export function estimateTravelTimeMinutes(
  distanceKm: number,
  mobility: MobilityMode | null | undefined,
  minimumMinutes: number = TIEMPO_MINIMO_TRASLADO_MIN,
): number {
  if (distanceKm <= 0) return 0;
  const mode: MobilityMode = mobility ?? 'caminando';
  const speedKmh = VELOCIDADES_KMH[mode] ?? VELOCIDADES_KMH.caminando;
  const calculated = Math.round((distanceKm / speedKmh) * 60);
  return Math.max(minimumMinutes, calculated);
}

/* ── 3. Manejo de Horas y Minutos ("HH:MM") ─────────────────────────────── */

const TIME_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/**
 * Convierte una cadena de hora "HH:MM" (o "HH:MM:SS") a minutos desde medianoche (0..1439).
 */
export function parseHHMMToMinutes(hhmm: string): number {
  const match = hhmm.trim().match(TIME_REGEX);
  if (!match) {
    throw new Error(`Formato de hora inválido: "${hhmm}". Se espera "HH:MM" o "HH:MM:SS".`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

/**
 * Convierte un número de minutos a formato "HH:MM" de 24 horas.
 * Normaliza valores mayores a 24 horas usando módulo de 1440 minutos.
 */
export function minutesToHHMM(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Suma minutos a una hora en formato "HH:MM".
 */
export function addMinutesToHHMM(hhmm: string, minutesToAdd: number): string {
  const current = parseHHMMToMinutes(hhmm);
  return minutesToHHMM(current + minutesToAdd);
}

/**
 * Calcula la diferencia en minutos entre dos horas "HH:MM".
 * Si endTime <= startTime, asume cruce legítimo de medianoche (ej. 23:00 -> 02:00 = 180 min).
 */
export function calculateTimeDifferenceMinutes(startTime: string, endTime: string): number {
  const start = parseHHMMToMinutes(startTime);
  let end = parseHHMMToMinutes(endTime);
  if (end <= start) {
    end += 1440;
  }
  return end - start;
}

/**
 * Convierte una fecha JavaScript Date al día de la semana numérico (1 = Lunes ... 7 = Domingo).
 */
export function dateToChaskiDayOfWeek(date: Date): number {
  const jsDay = date.getDay(); // 0 = Domingo, 1 = Lunes ... 6 = Sábado
  return jsDay === 0 ? 7 : jsDay;
}

/* ── 4. Régimen de Acceso y Disponibilidad de Horarios ───────────────────── */

export interface DetermineAccessOptions {
  /** Régimen predeterminado si el lugar no tiene `tipo_disponibilidad` persistido. */
  defaultAccessType?: AccessType;
}

/**
 * Determina el régimen de disponibilidad de un lugar.
 * Utiliza el valor explícito persistido en `place.tipo_disponibilidad` como fuente principal.
 * NO infiere automáticamente por categoría cuando existe o falta el dato.
 */
export function determineAccessType(
  place: Place,
  options?: DetermineAccessOptions,
): AccessType {
  // Fuente principal: campo explícito persistido en PostgreSQL/Supabase
  if (place.tipo_disponibilidad) {
    const raw = place.tipo_disponibilidad.trim().toUpperCase();
    if (raw === 'LIBRE_ACCESO') {
      return 'LIBRE_ACCESO';
    }
    if (raw === 'HORARIO_REGISTRADO') {
      return 'HORARIO_REGISTRADO';
    }
  }

  // Si no cuenta con el dato explícito, recurre al valor por defecto (HORARIO_REGISTRADO por seguridad)
  return options?.defaultAccessType ?? 'HORARIO_REGISTRADO';
}

/**
 * Verifica si un intervalo de horario [apertura, cierre] cubre de principio a fin
 * una visita [llegada, llegada + duracionMin].
 *
 * Restricción PostgreSQL real:
 * - `horarios_lugar` exige `hora_cierre > hora_apertura`.
 *
 * Como función pura de utilidad también admite:
 * - Cierre a medianoche ("00:00" cuando apertura > 0).
 * - Intervalos nocturnos si fueran provistos externamente (cierre < apertura).
 */
export function isIntervalContainingVisit(
  horaApertura: string,
  horaCierre: string,
  horaLlegada: string,
  duracionMin: number,
): boolean {
  if (duracionMin <= 0) return false;

  const apertura = parseHHMMToMinutes(horaApertura);
  const cierreRaw = parseHHMMToMinutes(horaCierre);
  const llegada = parseHHMMToMinutes(horaLlegada);
  const salida = llegada + duracionMin;

  // "00:00" como hora de cierre tras una apertura diurna representa la medianoche (minuto 1440)
  const cierre = cierreRaw === 0 && apertura > 0 ? 1440 : cierreRaw;

  // Caso 1: Intervalo estándar PostgreSQL (hora_cierre > hora_apertura)
  if (cierre >= apertura) {
    return llegada >= apertura && salida <= cierre;
  }

  // Caso 2: Intervalo nocturno extendido (soporte de utilidad)
  // Subcaso 2a: Llegada antes de medianoche
  if (llegada >= apertura) {
    const cierreExtendido = cierre + 1440;
    return salida <= cierreExtendido;
  }

  // Subcaso 2b: Llegada en la madrugada tras medianoche
  if (llegada < cierre) {
    return salida <= cierre;
  }

  return false;
}

export interface PlaceAvailabilityOptions {
  /** Día de la semana según convención Supabase: 1 = Lunes ... 7 = Domingo */
  diaSemana: number;
  /** Hora estimada de llegada en formato "HH:MM" */
  horaLlegada: string;
  /** Duración de la estancia/actividad en el lugar en minutos */
  duracionMin: number;
  /** Régimen de acceso explícito para evaluar. Si se omite, usa `determineAccessType(place)`. */
  accessType?: AccessType;
}

/**
 * Comprueba si un lugar está disponible para ser visitado cumpliendo todas las reglas:
 * - Lugar activo (estado === true).
 * - Si es LIBRE_ACCESO: disponible sin requerir horarios registrados.
 * - Si es HORARIO_REGISTRADO: requiere al menos un horario registrado para ese `diaSemana` (1..7)
 *   que cubra toda la duración de la visita.
 */
export function isPlaceAvailable(
  place: Place,
  options: PlaceAvailabilityOptions,
): boolean {
  // 1. Lugar inactivo: nunca elegible
  if (!place.estado) {
    return false;
  }

  // Validación de día de la semana (1 = Lunes a 7 = Domingo)
  if (!Number.isInteger(options.diaSemana) || options.diaSemana < 1 || options.diaSemana > 7) {
    return false;
  }

  if (options.duracionMin <= 0) {
    return false;
  }

  const access = options.accessType ?? determineAccessType(place);

  // 2. Libre acceso: activo es suficiente
  if (access === 'LIBRE_ACCESO') {
    return true;
  }

  // 3. Horario registrado: requiere catálogo de horarios
  const horarios = place.horarios ?? [];
  if (horarios.length === 0) {
    return false;
  }

  // Filtrar solo los horarios del día solicitado (no asumir que un horario aplica a toda la semana)
  const horariosDelDia = horarios.filter((h) => h.dia_semana === options.diaSemana);
  if (horariosDelDia.length === 0) {
    return false;
  }

  // Al menos un intervalo del día debe contener la visita completa
  return horariosDelDia.some((h) =>
    isIntervalContainingVisit(h.hora_apertura, h.hora_cierre, options.horaLlegada, options.duracionMin),
  );
}

/* ── 5. Presupuesto y Tiempo Acumulados ──────────────────────────────────── */

/**
 * Valida si agregar un lugar respeta el tope de presupuesto.
 */
export function isBudgetViable(
  accumulatedCost: number,
  placeCost: number,
  maxBudget: number,
): boolean {
  return accumulatedCost + placeCost <= maxBudget;
}

/**
 * Valida si agregar un lugar (traslado + duración de estancia) cabe en el tiempo disponible.
 */
export function isTimeViable(
  accumulatedMinutes: number,
  travelMinutes: number,
  stayMinutes: number,
  maxMinutes: number,
): boolean {
  return accumulatedMinutes + travelMinutes + stayMinutes <= maxMinutes;
}

/* ── 6. Categorías e Intereses ─────────────────────────────────────────── */

/**
 * Mapea la lista de intereses del Wizard hacia las categorías correspondientes del catálogo.
 * Retorna null si no se especificaron intereses (lo que indica no filtrar).
 */
export function mapInterestsToCategories(interests: string[]): string[] | null {
  if (!interests || interests.length === 0) {
    return null;
  }
  const matched = new Set<string>();
  for (const interest of interests) {
    const categories = MAPA_INTERESES_CATEGORIAS[interest] ?? [];
    for (const c of categories) {
      matched.add(c);
    }
  }
  return matched.size > 0 ? Array.from(matched) : null;
}

/**
 * Verifica si un lugar satisface los intereses seleccionados por el usuario.
 * Si la lista de intereses está vacía, cualquier lugar es elegible.
 */
export function isPlaceMatchingInterests(
  place: Place,
  selectedInterests: string[],
): boolean {
  const desiredCategories = mapInterestsToCategories(selectedInterests);
  if (!desiredCategories) {
    return true;
  }
  const placeCategories = (place.categorias ?? []).map((c) => c.nombre);
  return placeCategories.some((c) => desiredCategories.includes(c));
}

/* ── 7. Control de Lugares Repetidos ────────────────────────────────────── */

/**
 * Verifica si un lugar ya fue visitado o incluido en el recorrido actual.
 */
export function isPlaceAlreadyVisited(
  placeId: string,
  visitedPlaces: Set<string> | string[],
): boolean {
  if (visitedPlaces instanceof Set) {
    return visitedPlaces.has(placeId);
  }
  return visitedPlaces.includes(placeId);
}

/**
 * Verifica si un lugar puede ser agregado a la ruta (no ha sido visitado previamente).
 */
export function canAddPlaceToRoute(
  placeId: string,
  currentRoutePlaces: Set<string> | string[],
): boolean {
  return !isPlaceAlreadyVisited(placeId, currentRoutePlaces);
}
