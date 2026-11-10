/**
 * Reordenamiento geográfico de las paradas de un plan (Fase 2.1 · Serie AX).
 *
 * Problema que resuelve.
 * El motor agrega paradas de forma voraz pero nunca reordena la secuencia, así
 * que encadena tramos largos y vuelve sobre sus pasos (p. ej. Miraflores →
 * Barranco → Miraflores). Medido en la app real: el "Plan Equilibrado" hacía
 * 8.31 km cuando el orden óptimo de las mismas paradas son 5.04 km (−39%).
 * Ese kilometraje de más consume minutos de la ventana del usuario y por eso
 * los planes terminan con menos paradas de las que podrían caber.
 *
 * Estrategia.
 * - La parada 0 (el ancla del plan) NUNCA se mueve: es el punto de entrada
 *   elegido por la variante y varios tests de caracterización lo afirman.
 * - Se permutan solo las paradas 1..n-1. Con maxStops ≤ 5 el espacio es como
 *   máximo 4! = 24 permutaciones, así que se evalúan todas (óptimo exacto, sin
 *   heurísticas) y se elige la de menor distancia que siga siendo factible.
 * - Factibilidad = cada parada sigue abierta a la hora de llegada que produce
 *   el nuevo orden (misma regla que usa el motor: `isPlaceAvailable`). Si
 *   ninguna permutación es factible, se devuelve el orden original y el
 *   llamador conserva sus acumulados intactos (`reordenado: false`).
 *
 * Es una función pura y determinista: mismo input → mismo output, sin
 * `Math.random()` ni lectura de reloj.
 */

import type { PlanStop } from './plan-engine';
import {
  calculateHaversineDistanceKm,
  DURACION_POR_DEFECTO_MIN,
  estimateTravelTimeMinutes,
  isPlaceAvailable,
  minutesToHHMM,
  type MobilityMode,
} from './viability';

export interface RouteOrderContext {
  /** Punto de partida del usuario. */
  origen: { lat: number; lng: number };
  /** Medio de transporte elegido en el wizard (null → caminando, como el motor). */
  movilidad: MobilityMode | null | undefined;
  /** Minutos desde medianoche de la hora de inicio del plan. */
  startMinutes: number;
  /** Día ISO 1..7 (1 = lunes) del inicio, usado para validar horarios. */
  diaSemanaInicial: number;
}

export interface RouteOrderResult {
  /** Paradas en el orden final (vacío de cambios si `reordenado` es false). */
  paradas: PlanStop[];
  /** Distancia total incluyendo el traslado desde el origen a la 1ª parada. */
  distanciaKm: number;
  /** Duración total (traslados + permanencias), coherente con el motor. */
  duracionTotalMin: number;
  /** true si el orden final difiere del recibido. */
  reordenado: boolean;
  /** Kilómetros ahorrados respecto al orden recibido (≥ 0). */
  ahorroKm: number;
}

/** Tope defensivo: por encima de esto se deja el orden original. */
const MAX_PERMUTACIONES = 720;

const MINUTOS_POR_DIA = 1440;

interface Evaluacion {
  distanciaKm: number;
  duracionTotalMin: number;
  factible: boolean;
  llegadas: string[];
  traslados: number[];
}

/**
 * Simula la línea de tiempo de un orden concreto: traslado, llegada, control de
 * horario y permanencia, acumulando distancia y duración.
 */
function evaluarOrden(orden: PlanStop[], ctx: RouteOrderContext): Evaluacion {
  let minutoActual = ctx.startMinutes;
  let lat = ctx.origen.lat;
  let lng = ctx.origen.lng;
  let distanciaKm = 0;
  let duracionTotalMin = 0;
  let factible = true;

  const llegadas: string[] = [];
  const traslados: number[] = [];

  for (const parada of orden) {
    const km = calculateHaversineDistanceKm(
      lat,
      lng,
      parada.place.latitud,
      parada.place.longitud,
    );
    const traslado = estimateTravelTimeMinutes(km, ctx.movilidad);

    const llegadaAbs = minutoActual + traslado;
    const diasPasados = Math.floor(llegadaAbs / MINUTOS_POR_DIA);
    const diaSemanaParada = ((ctx.diaSemanaInicial - 1 + diasPasados) % 7) + 1;
    const horaLlegada = minutesToHHMM(llegadaAbs % MINUTOS_POR_DIA);
    const duracionLugar =
      parada.duracion_min ?? parada.place.duracion_sugerida_min ?? DURACION_POR_DEFECTO_MIN;

    if (
      !isPlaceAvailable(parada.place, {
        diaSemana: diaSemanaParada,
        horaLlegada,
        duracionMin: duracionLugar,
      })
    ) {
      factible = false;
    }

    distanciaKm += km;
    duracionTotalMin += traslado + duracionLugar;
    llegadas.push(horaLlegada);
    traslados.push(traslado);

    minutoActual = llegadaAbs + duracionLugar;
    lat = parada.place.latitud;
    lng = parada.place.longitud;
  }

  return { distanciaKm, duracionTotalMin, factible, llegadas, traslados };
}

/** Genera todas las permutaciones de una lista (lista corta: ≤ 6 elementos). */
function permutar<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];

  const resultado: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const resto = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const permutacion of permutar(resto)) {
      resultado.push([items[i], ...permutacion]);
    }
  }
  return resultado;
}

/** Reconstruye las paradas con el orden, hora de llegada y traslado finales. */
function materializar(
  orden: PlanStop[],
  evaluacion: Evaluacion,
): PlanStop[] {
  return orden.map((parada, idx) => ({
    ...parada,
    orden: idx + 1,
    llegada: evaluacion.llegadas[idx],
    traslado_desde_anterior_min: evaluacion.traslados[idx],
  }));
}

/**
 * Devuelve las paradas reordenadas para minimizar la distancia recorrida sin
 * romper horarios. Si no hay mejora factible, devuelve el orden original.
 */
export function optimizarOrdenParadas(
  paradas: PlanStop[],
  ctx: RouteOrderContext,
): RouteOrderResult {
  const base = evaluarOrden(paradas, ctx);

  const sinCambios: RouteOrderResult = {
    paradas,
    distanciaKm: base.distanciaKm,
    duracionTotalMin: base.duracionTotalMin,
    reordenado: false,
    ahorroKm: 0,
  };

  // Con 0, 1 o 2 paradas no hay nada que optimizar (el ancla es fija).
  if (paradas.length < 3) {
    return sinCambios;
  }

  const ancla = paradas[0];
  const cola = paradas.slice(1);

  if (permutar(cola).length > MAX_PERMUTACIONES) {
    return sinCambios;
  }

  // El orden actual debe ser factible para considerar mejoras: si el motor ya
  // entregó algo que no valida (p. ej. lugar libre de horario), no se toca.
  if (!base.factible) {
    return sinCambios;
  }

  let mejor: { orden: PlanStop[]; evaluacion: Evaluacion } | null = null;

  for (const permutacion of permutar(cola)) {
    const candidato = [ancla, ...permutacion];

    // Si el orden es idéntico al actual no aporta nada nuevo.
    if (candidato.every((p, i) => p.place.id === paradas[i].place.id)) {
      continue;
    }

    const evaluacion = evaluarOrden(candidato, ctx);
    if (!evaluacion.factible) continue;

    if (mejor === null) {
      mejor = { orden: candidato, evaluacion };
      continue;
    }

    const mejoraKm = evaluacion.distanciaKm < mejor.evaluacion.distanciaKm - 1e-9;
    const empateKm =
      Math.abs(evaluacion.distanciaKm - mejor.evaluacion.distanciaKm) <= 1e-9;

    // Desempate determinista: terminar antes y, si persiste, orden alfabético
    // de ids para que dos corridas idénticas elijan siempre lo mismo.
    const terminaAntes =
      empateKm && evaluacion.duracionTotalMin < mejor.evaluacion.duracionTotalMin;
    const firmaCandidato = candidato.map((p) => p.place.id).join('|');
    const firmaMejor = mejor.orden.map((p) => p.place.id).join('|');
    const ganaAlfabetico = empateKm && !terminaAntes && firmaCandidato < firmaMejor;

    if (mejoraKm || terminaAntes || ganaAlfabetico) {
      mejor = { orden: candidato, evaluacion };
    }
  }

  if (mejor === null) {
    return sinCambios;
  }

  const ahorroKm = Math.max(0, base.distanciaKm - mejor.evaluacion.distanciaKm);

  // Umbral anti-ruido: menos de 50 m de ahorro no justifica cambiar el orden.
  if (ahorroKm < 0.05) {
    return sinCambios;
  }

  return {
    paradas: materializar(mejor.orden, mejor.evaluacion),
    distanciaKm: mejor.evaluacion.distanciaKm,
    duracionTotalMin: mejor.evaluacion.duracionTotalMin,
    reordenado: true,
    ahorroKm,
  };
}
