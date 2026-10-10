/**
 * Motor de planes Chaski — Soporta estrategias GREEDY y BEAM_SEARCH con 3 variantes
 * e integración exhaustiva de viabilidad (tiempo, presupuesto, horarios y movilidad)
 * y scoring multicriterio definitivo para BEAM_SEARCH.
 *
 * Entrada: la solicitud del wizard (WizardPlanRequest) + los lugares de Supabase.
 * Salida: hasta 3 planes (íntimo / equilibrado / explorador) con paradas viables ordenadas,
 * costos, tiempos calculados, validación estricta de disponibilidad y puntuación multicriterio.
 */
import type { Place } from '@/features/places/interface/places.interface';
import type { PlanStrategy, WizardPlanRequest } from '@/features/wizard/context/wizard-context';
import {
  calculateMultiCriteriaScore,
  type MultiCriteriaScoreBreakdown,
  PESOS_SCORING,
} from './scoring';
import {
  calculateHaversineDistanceKm,
  dateToChaskiDayOfWeek,
  estimateTravelTimeMinutes,
  isBudgetViable,
  isPlaceAlreadyVisited,
  isPlaceAvailable,
  isPlaceMatchingInterests,
  isTimeViable,
  minutesToHHMM,
  parseHHMMToMinutes,
} from './viability';

export type { PlanStrategy };
export { PESOS_SCORING, calculateMultiCriteriaScore };
export type { MultiCriteriaScoreBreakdown };

export interface PlanEngineOptions {
  strategy?: PlanStrategy;
  beamWidth?: number;
}

export const DEFAULT_BEAM_WIDTH = 3;

export interface PlanStop {
  place: Place;
  orden: number;
  llegada: string; // "HH:MM" estimada
  duracion_min: number;
  traslado_desde_anterior_min: number;
  costo_estimado: number; // gasto_max del lugar (peor caso)
}

export interface GeneratedPlan {
  id: string;
  titulo: string;
  descripcion: string;
  variante: 'intimo' | 'equilibrado' | 'explorador';
  paradas: PlanStop[];
  duracion_total_min: number;
  costo_total: number;
  distancia_km_aprox: number;
  score?: number;
  scoreBreakdown?: MultiCriteriaScoreBreakdown;
}

/* ── Variantes del motor ────────────────────────────────────────────────── */

export interface VarianteConfig {
  id: 'intimo' | 'equilibrado' | 'explorador';
  maxStops: number;
  titulo: string;
  sesgo: 'point' | 'recommended' | 'casual';
  /** Fracción de presupuesto/tiempo usada — fuerza diversidad entre variantes. */
  presupuestoFrac: number;
  tiempoFrac: number;
  /** Dónde arranca el recorrido: garantiza que la 1.ª parada difiera por variante. */
  ancla: 'cercana' | 'media' | 'lejana';
}

export const VARIANTES: VarianteConfig[] = [
  { id: 'intimo', maxStops: 3, titulo: 'Ruta Íntima', sesgo: 'point', presupuestoFrac: 0.6, tiempoFrac: 0.55, ancla: 'cercana' },
  { id: 'equilibrado', maxStops: 4, titulo: 'Plan Equilibrado', sesgo: 'recommended', presupuestoFrac: 0.85, tiempoFrac: 0.8, ancla: 'media' },
  { id: 'explorador', maxStops: 5, titulo: 'Ruta Exploradora', sesgo: 'casual', presupuestoFrac: 1, tiempoFrac: 1, ancla: 'lejana' },
];

/* ── Estructura de Estado para BEAM_SEARCH ───────────────────────────────── */

export interface BeamState {
  paradas: PlanStop[];
  costoAcum: number;
  tiempoAcum: number;
  distAcum: number;
  latActual: number;
  lonActual: number;
  usados: Set<string>;
  score: number;
  scoreBreakdown?: MultiCriteriaScoreBreakdown;
}

/**
 * Función de evaluación provisional (conservada por retrocompatibilidad).
 */
export function provisionalRouteScore(
  paradas: PlanStop[],
  distAcumKm: number,
  sesgo: 'point' | 'recommended' | 'casual',
): number {
  let score = paradas.length * 1000;

  for (const p of paradas) {
    const durLugar = p.duracion_min;
    const tierBonus =
      durLugar === 60 && sesgo === 'point' ? 0.25 :
      durLugar === 40 && sesgo === 'recommended' ? 0.2 :
      durLugar <= 30 && sesgo === 'casual' ? 0.15 : 0;
    score += tierBonus * 100;
  }

  score -= distAcumKm * 5;

  return score;
}

/**
 * Comparador determinista entre dos estados de Beam Search.
 * Si los scores difieren, prioriza el mayor score.
 * En caso de empate exacto, aplica un desempate lexicográfico determinista por ID de paradas.
 */
function isStateBetter(a: BeamState, b: BeamState): boolean {
  if (Math.abs(a.score - b.score) > 1e-6) {
    return a.score > b.score;
  }
  const sigA = a.paradas.map((p) => p.place.id).join('|');
  const sigB = b.paradas.map((p) => p.place.id).join('|');
  return sigA.localeCompare(sigB) < 0;
}

/* ── Contexto común para la ejecución de los algoritmos ─────────────────── */

interface PlanEngineContext {
  request: WizardPlanRequest;
  candidatos: Place[];
  origen: { lat: number; lng: number };
  presupuesto: number;
  startMinutes: number;
  diaSemanaInicial: number;
}

/* ── 1. Estrategia GREEDY ───────────────────────────────────────────────── */

function ejecutarGreedy(ctx: PlanEngineContext): GeneratedPlan[] {
  const { request, candidatos, origen, presupuesto, startMinutes, diaSemanaInicial } = ctx;

  const planes = VARIANTES.map((v) => {
    const presupuestoV = Math.floor(presupuesto * v.presupuestoFrac);
    const minutosV = Math.floor((request.minutosTotales ?? 240) * v.tiempoFrac);
    const paradas: PlanStop[] = [];
    let lat = origen.lat, lon = origen.lng;
    let costoAcum = 0;
    let tiempoAcum = 0;
    let distAcum = 0;
    const usados = new Set<string>();

    // Candidatos ordenados por distancia desde el origen
    const ordenDist = candidatos
      .map((l) => ({ l, km: calculateHaversineDistanceKm(origen.lat, origen.lng, l.latitud, l.longitud) }))
      .sort((a, b) => a.km - b.km);

    const cabe = (o: { l: Place; km: number }) => {
      const tAncla = estimateTravelTimeMinutes(o.km, request.movilidad);
      const durLugar = o.l.duracion_sugerida_min ?? 30;
      const costoLugar = o.l.gasto_max ?? 0;

      if (!isBudgetViable(0, costoLugar, presupuestoV)) return false;
      if (!isTimeViable(0, tAncla, durLugar, minutosV)) return false;

      // Calcular llegada y día para parada 1 considerando cruce de medianoche
      const llegadaAbs = startMinutes + tAncla;
      const diasPasados = Math.floor(llegadaAbs / 1440);
      const diaSemanaParada = ((diaSemanaInicial - 1 + diasPasados) % 7) + 1;
      const horaLlegada = minutesToHHMM(llegadaAbs % 1440);

      return isPlaceAvailable(o.l, {
        diaSemana: diaSemanaParada,
        horaLlegada,
        duracionMin: durLugar,
      });
    };

    const viables = ordenDist.filter(cabe);
    if (viables.length) {
      const idx =
        v.ancla === 'cercana' ? 0
        : v.ancla === 'media' ? Math.floor((viables.length - 1) / 2)
        : viables.length - 1;
      const a = viables[idx];
      const tAncla = estimateTravelTimeMinutes(a.km, request.movilidad);
      const durLugar = a.l.duracion_sugerida_min ?? 30;
      const costoLugar = a.l.gasto_max ?? 0;

      const llegadaAbs = startMinutes + tAncla;
      const horaLlegada = minutesToHHMM(llegadaAbs % 1440);

      usados.add(a.l.id);
      distAcum += a.km;
      tiempoAcum += tAncla + durLugar;
      costoAcum += costoLugar;

      paradas.push({
        place: a.l,
        orden: 1,
        llegada: horaLlegada,
        duracion_min: durLugar,
        traslado_desde_anterior_min: tAncla,
        costo_estimado: costoLugar,
      });

      lat = a.l.latitud;
      lon = a.l.longitud;
    }

    // Siguientes paradas: Selección Greedy evaluando viabilidad
    for (let i = 1; i < v.maxStops; i++) {
      let mejor: {
        lugar: Place;
        km: number;
        t: number;
        score: number;
        horaLlegada: string;
        durLugar: number;
        costoLugar: number;
      } | null = null;

      for (const l of candidatos) {
        if (isPlaceAlreadyVisited(l.id, usados)) continue;

        const km = calculateHaversineDistanceKm(lat, lon, l.latitud, l.longitud);
        const t = estimateTravelTimeMinutes(km, request.movilidad);
        const costoLugar = l.gasto_max ?? 0;
        if (!isBudgetViable(costoAcum, costoLugar, presupuestoV)) continue;

        const durLugar = l.duracion_sugerida_min ?? 30;
        if (!isTimeViable(tiempoAcum, t, durLugar, minutosV)) continue;

        // Calcular hora y día de llegada con el traslado acumulado
        const llegadaAbs = startMinutes + tiempoAcum + t;
        const diasPasados = Math.floor(llegadaAbs / 1440);
        const diaSemanaParada = ((diaSemanaInicial - 1 + diasPasados) % 7) + 1;
        const horaLlegada = minutesToHHMM(llegadaAbs % 1440);

        // Validar disponibilidad antes de elegir el candidato
        if (!isPlaceAvailable(l, {
          diaSemana: diaSemanaParada,
          horaLlegada,
          duracionMin: durLugar,
        })) {
          continue;
        }

        const tierBonus =
          durLugar === 60 && v.sesgo === 'point' ? 0.25 :
          durLugar === 40 && v.sesgo === 'recommended' ? 0.2 :
          durLugar <= 30 && v.sesgo === 'casual' ? 0.15 : 0;
        const score = km * (1 - tierBonus);

        if (!mejor || score < mejor.score) {
          mejor = { lugar: l, km, t, score, horaLlegada, durLugar, costoLugar };
        }
      }

      if (!mejor) break;

      usados.add(mejor.lugar.id);
      distAcum += mejor.km;
      tiempoAcum += mejor.t + mejor.durLugar;
      costoAcum += mejor.costoLugar;

      paradas.push({
        place: mejor.lugar,
        orden: paradas.length + 1,
        llegada: mejor.horaLlegada,
        duracion_min: mejor.durLugar,
        traslado_desde_anterior_min: mejor.t,
        costo_estimado: mejor.costoLugar,
      });

      lat = mejor.lugar.latitud;
      lon = mejor.lugar.longitud;
    }

    if (!paradas.length) {
      return {
        id: `${v.id}-${Date.now()}`,
        titulo: v.titulo,
        descripcion: 'No encontramos paradas dentro de tus filtros. Prueba con más presupuesto o tiempo.',
        variante: v.id,
        paradas: [],
        duracion_total_min: 0,
        costo_total: 0,
        distancia_km_aprox: 0,
      };
    }

    return {
      id: `${v.id}-${Date.now()}`,
      titulo: v.titulo,
      descripcion: `${paradas.length} ${paradas.length === 1 ? 'parada' : 'paradas'} desde ${paradas[0].place.nombre}`,
      variante: v.id,
      paradas,
      duracion_total_min: tiempoAcum,
      costo_total: costoAcum,
      distancia_km_aprox: Math.round(distAcum * 10) / 10,
    };
  });

  return planes
    .filter((plan) => plan.paradas.length > 0)
    // Deduplicación real: si 2 variantes convergen a la misma secuencia de lugares, se conserva la primera
    .filter((plan, idx, todos) => {
      const firma = plan.paradas.map((p) => p.place.id).join('|');
      const primero = todos.findIndex(
        (o) => o.paradas.map((p) => p.place.id).join('|') === firma,
      );
      return primero === idx;
    });
}

/* ── 2. Estrategia BEAM_SEARCH ──────────────────────────────────────────── */

interface BeamSearchContext extends PlanEngineContext {
  beamWidth: number;
}

function ejecutarBeamSearch(ctx: BeamSearchContext): GeneratedPlan[] {
  const { request, candidatos, origen, presupuesto, startMinutes, diaSemanaInicial, beamWidth } = ctx;

  const planes = VARIANTES.map((v) => {
    const presupuestoV = Math.floor(presupuesto * v.presupuestoFrac);
    const minutosV = Math.floor((request.minutosTotales ?? 240) * v.tiempoFrac);

    // Candidatos ordenados por distancia desde el origen
    const ordenDist = candidatos
      .map((l) => ({ l, km: calculateHaversineDistanceKm(origen.lat, origen.lng, l.latitud, l.longitud) }))
      .sort((a, b) => a.km - b.km);

    const cabeAncla = (o: { l: Place; km: number }) => {
      const tAncla = estimateTravelTimeMinutes(o.km, request.movilidad);
      const durLugar = o.l.duracion_sugerida_min ?? 30;
      const costoLugar = o.l.gasto_max ?? 0;

      if (!isBudgetViable(0, costoLugar, presupuestoV)) return false;
      if (!isTimeViable(0, tAncla, durLugar, minutosV)) return false;

      const llegadaAbs = startMinutes + tAncla;
      const diasPasados = Math.floor(llegadaAbs / 1440);
      const diaSemanaParada = ((diaSemanaInicial - 1 + diasPasados) % 7) + 1;
      const horaLlegada = minutesToHHMM(llegadaAbs % 1440);

      return isPlaceAvailable(o.l, {
        diaSemana: diaSemanaParada,
        horaLlegada,
        duracionMin: durLugar,
      });
    };

    const viablesAncla = ordenDist.filter(cabeAncla);
    if (!viablesAncla.length) {
      return null;
    }

    // Generar semillas iniciales para el haz según la identidad de ancla de la variante
    let semillas: typeof viablesAncla = [];
    if (v.ancla === 'cercana') {
      semillas = viablesAncla.slice(0, beamWidth);
    } else if (v.ancla === 'lejana') {
      semillas = [...viablesAncla].reverse().slice(0, beamWidth);
    } else {
      // media: lugares cercanos a la mediana de distancia
      const medianIdx = Math.floor((viablesAncla.length - 1) / 2);
      const indexados = viablesAncla.map((item, idx) => ({ item, distToMedian: Math.abs(idx - medianIdx) }));
      indexados.sort((a, b) => a.distToMedian - b.distToMedian);
      semillas = indexados.slice(0, beamWidth).map((x) => x.item);
    }

    // Inicializar los estados del haz (profundidad 1) con scoring multicriterio
    let currentBeam: BeamState[] = semillas.map((a) => {
      const tAncla = estimateTravelTimeMinutes(a.km, request.movilidad);
      const durLugar = a.l.duracion_sugerida_min ?? 30;
      const costoLugar = a.l.gasto_max ?? 0;

      const llegadaAbs = startMinutes + tAncla;
      const horaLlegada = minutesToHHMM(llegadaAbs % 1440);

      const stop1: PlanStop = {
        place: a.l,
        orden: 1,
        llegada: horaLlegada,
        duracion_min: durLugar,
        traslado_desde_anterior_min: tAncla,
        costo_estimado: costoLugar,
      };

      const breakdown = calculateMultiCriteriaScore({
        paradas: [stop1],
        interesesUsuario: request.intereses,
        tiempoTotalMin: tAncla + durLugar,
        tiempoMaximoMin: minutosV,
        presupuestoMaximo: presupuestoV,
      });

      return {
        paradas: [stop1],
        costoAcum: costoLugar,
        tiempoAcum: tAncla + durLugar,
        distAcum: a.km,
        latActual: a.l.latitud,
        lonActual: a.l.longitud,
        usados: new Set([a.l.id]),
        score: breakdown.scoreTotal,
        scoreBreakdown: breakdown,
      };
    });

    if (!currentBeam.length) return null;

    let bestState: BeamState = currentBeam[0];
    for (const s of currentBeam) {
      if (isStateBetter(s, bestState)) {
        bestState = s;
      }
    }

    // Expansión del haz hasta maxStops
    for (let step = 2; step <= v.maxStops; step++) {
      const nextCandidates: BeamState[] = [];

      for (const state of currentBeam) {
        for (const l of candidatos) {
          // Descartar ciclos y lugares ya visitados en esta rama
          if (isPlaceAlreadyVisited(l.id, state.usados)) continue;

          const km = calculateHaversineDistanceKm(state.latActual, state.lonActual, l.latitud, l.longitud);
          const t = estimateTravelTimeMinutes(km, request.movilidad);
          const costoLugar = l.gasto_max ?? 0;

          // Descartar inmediatamente estados inviables por presupuesto o tiempo
          if (!isBudgetViable(state.costoAcum, costoLugar, presupuestoV)) continue;

          const durLugar = l.duracion_sugerida_min ?? 30;
          if (!isTimeViable(state.tiempoAcum, t, durLugar, minutosV)) continue;

          // Descartar lugares inviables por horario y día de semana (considerando medianoche)
          const llegadaAbs = startMinutes + state.tiempoAcum + t;
          const diasPasados = Math.floor(llegadaAbs / 1440);
          const diaSemanaParada = ((diaSemanaInicial - 1 + diasPasados) % 7) + 1;
          const horaLlegada = minutesToHHMM(llegadaAbs % 1440);

          if (!isPlaceAvailable(l, {
            diaSemana: diaSemanaParada,
            horaLlegada,
            duracionMin: durLugar,
          })) {
            continue;
          }

          const newStop: PlanStop = {
            place: l,
            orden: state.paradas.length + 1,
            llegada: horaLlegada,
            duracion_min: durLugar,
            traslado_desde_anterior_min: t,
            costo_estimado: costoLugar,
          };

          const newParadas = [...state.paradas, newStop];
          const newDistAcum = state.distAcum + km;
          const newTiempoAcum = state.tiempoAcum + t + durLugar;
          const newCostoAcum = state.costoAcum + costoLugar;

          const breakdown = calculateMultiCriteriaScore({
            paradas: newParadas,
            interesesUsuario: request.intereses,
            tiempoTotalMin: newTiempoAcum,
            tiempoMaximoMin: minutosV,
            presupuestoMaximo: presupuestoV,
          });

          nextCandidates.push({
            paradas: newParadas,
            costoAcum: newCostoAcum,
            tiempoAcum: newTiempoAcum,
            distAcum: newDistAcum,
            latActual: l.latitud,
            lonActual: l.longitud,
            usados: new Set([...state.usados, l.id]),
            score: breakdown.scoreTotal,
            scoreBreakdown: breakdown,
          });
        }
      }

      if (nextCandidates.length === 0) {
        // Ningún estado pudo expandirse más dentro de las restricciones
        break;
      }

      // Deduplicar estados candidatos por firma de paradas (mismos lugares en el mismo orden)
      const uniqueCandidates: BeamState[] = [];
      const seenSignatures = new Set<string>();

      for (const cand of nextCandidates) {
        const signature = cand.paradas.map((p) => p.place.id).join('->');
        if (!seenSignatures.has(signature)) {
          seenSignatures.add(signature);
          uniqueCandidates.push(cand);
        }
      }

      // Ordenar candidatos por score multicriterio descendente con desempate determinista
      uniqueCandidates.sort((a, b) => {
        if (Math.abs(b.score - a.score) > 1e-6) {
          return b.score - a.score;
        }
        const sigA = a.paradas.map((p) => p.place.id).join('|');
        const sigB = b.paradas.map((p) => p.place.id).join('|');
        return sigA.localeCompare(sigB);
      });

      // Conservar únicamente los mejores K estados por profundidad
      currentBeam = uniqueCandidates.slice(0, beamWidth);

      // Actualizar el mejor estado global encontrado
      for (const s of currentBeam) {
        if (isStateBetter(s, bestState)) {
          bestState = s;
        }
      }
    }

    const plan: GeneratedPlan = {
      id: `${v.id}-${Date.now()}`,
      titulo: v.titulo,
      descripcion: `${bestState.paradas.length} ${bestState.paradas.length === 1 ? 'parada' : 'paradas'} desde ${bestState.paradas[0].place.nombre}`,
      variante: v.id,
      paradas: bestState.paradas,
      duracion_total_min: bestState.tiempoAcum,
      costo_total: bestState.costoAcum,
      distancia_km_aprox: Math.round(bestState.distAcum * 10) / 10,
      score: bestState.score,
      scoreBreakdown: bestState.scoreBreakdown,
    };

    return plan;
  });

  return planes
    .filter((plan): plan is GeneratedPlan => plan !== null && plan.paradas.length > 0)
    // Deduplicación real entre variantes: si 2 variantes generan la misma secuencia, se conserva la primera
    .filter((plan, idx, todos) => {
      const firma = plan.paradas.map((p) => p.place.id).join('|');
      const primero = todos.findIndex(
        (o) => o.paradas.map((p) => p.place.id).join('|') === firma,
      );
      return primero === idx;
    });
}

/* ── 3. Función Principal de Generación ─────────────────────────────────── */

/**
 * Genera hasta 3 alternativas de planes de recorrido (íntimo, equilibrado, explorador).
 * Por defecto utiliza la estrategia GREEDY. Admite la estrategia BEAM_SEARCH mediante
 * el parámetro opcional `options` o mediante `request.estrategia`.
 */
export function generarPlanes(
  request: WizardPlanRequest,
  lugares: Place[],
  options?: PlanEngineOptions | PlanStrategy,
): GeneratedPlan[] {
  const origen = request.ubicacion;
  if (!origen?.lat || !origen?.lng) return [];

  // Filtro duro inicial: activos, cercanía razonable (<=12km del origen) e intereses
  const candidatos = lugares.filter((l) => {
    if (!l.estado) return false;
    const d = calculateHaversineDistanceKm(origen.lat!, origen.lng!, l.latitud, l.longitud);
    if (d > 12) return false;
    return isPlaceMatchingInterests(l, request.intereses);
  });

  if (!candidatos.length) return [];

  const normalizedOptions: PlanEngineOptions =
    typeof options === 'string' ? { strategy: options } : (options ?? {});
  const strategy: PlanStrategy =
    normalizedOptions.strategy ?? request.estrategia ?? 'GREEDY';

  const presupuesto = request.presupuesto ?? 0;
  const horaInicioStr = request.horaInicio ?? '09:00';
  const startMinutes = parseHHMMToMinutes(horaInicioStr);

  const baseDate = request.fecha ? new Date(request.fecha) : new Date();
  const diaSemanaInicial = request.diaSemana ?? dateToChaskiDayOfWeek(baseDate);

  const ctx: PlanEngineContext = {
    request,
    candidatos,
    origen: { lat: origen.lat, lng: origen.lng },
    presupuesto,
    startMinutes,
    diaSemanaInicial,
  };

  if (strategy === 'BEAM_SEARCH') {
    const beamWidth = Math.max(1, normalizedOptions.beamWidth ?? DEFAULT_BEAM_WIDTH);
    return ejecutarBeamSearch({
      ...ctx,
      beamWidth,
    });
  }

  return ejecutarGreedy(ctx);
}
