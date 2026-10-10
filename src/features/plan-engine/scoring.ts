/**
 * Módulo de Scoring Multicriterio Definitivo para Chaski.
 *
 * Evalúa recorridos candidatos de BEAM_SEARCH de forma normalizada (0–100),
 * determinista, desacoplada y explicable bajo 4 criterios ponderados:
 *  1. Cobertura de intereses: 35 %
 *  2. Aprovechamiento del tiempo: 25 %
 *  3. Compatibilidad presupuestaria: 20 %
 *  4. Eficiencia de desplazamiento: 20 %
 */

import type { PlanStop } from './plan-engine';
import { mapInterestsToCategories } from './viability';

export interface MultiCriteriaScoreBreakdown {
  /** Proporción de categorías solicitadas cubiertas sin duplicados (0–100). */
  coberturaIntereses: number;
  /** Utilización del tiempo con margen de holgura razonable (0–100). */
  aprovechamientoTiempo: number;
  /** Compatibilidad con el presupuesto asignado sin premiar gasto excesivo (0–100). */
  compatibilidadPresupuesto: number;
  /** Relación entre tiempo de visita efectiva y tiempo de traslado (0–100). */
  eficienciaDesplazamiento: number;
  /** Puntuación global ponderada (0–100). */
  scoreTotal: number;
}

export const PESOS_SCORING = {
  coberturaIntereses: 0.35,
  aprovechamientoTiempo: 0.25,
  compatibilidadPresupuesto: 0.20,
  eficienciaDesplazamiento: 0.20,
} as const;

/* ── 1. Cobertura de Intereses (35 %) ───────────────────────────────────── */

/**
 * Evalúa la proporción de categorías solicitadas representadas en el recorrido.
 * - Evita contar repetidamente una misma categoría como cobertura adicional (usa Set).
 * - Si el usuario no especificó intereses, la cobertura es abierta (100).
 */
export function calculateInterestCoverageScore(
  paradas: PlanStop[],
  interesesUsuario: string[],
): number {
  if (!paradas || paradas.length === 0) return 0;

  // Únicamente si el usuario NO especificó intereses (exploración abierta), cobertura es 100
  if (!interesesUsuario || interesesUsuario.length === 0) {
    return 100;
  }

  const targetCategories = mapInterestsToCategories(interesesUsuario);
  // Si especificó intereses pero ninguno tiene categorías compatibles en la BD: 0 puntos
  if (!targetCategories || targetCategories.length === 0) {
    return 0;
  }

  const visitedCategories = new Set<string>();
  for (const p of paradas) {
    for (const cat of p.place.categorias ?? []) {
      visitedCategories.add(cat.nombre);
    }
  }

  let coveredCount = 0;
  for (const target of targetCategories) {
    if (visitedCategories.has(target)) {
      coveredCount++;
    }
  }

  const ratio = coveredCount / targetCategories.length;
  return Math.min(100, Math.max(0, ratio * 100));
}

/* ── 2. Aprovechamiento del Tiempo (25 %) ────────────────────────────────── */

/**
 * Evalúa la proporción del tiempo disponible utilizada por el recorrido.
 * - Rechaza (0 pts) si el recorrido excede el límite disponible.
 * - Considera óptimo un aprovechamiento con margen de holgura (75% a 90% de uso = 100 pts).
 * - Ocupar el 100 % del tiempo recibe una ligera penalización (90 pts) respecto a dejar margen razonable.
 */
export function calculateTimeUtilizationScore(
  tiempoTotalRutaMin: number,
  tiempoMaximoMin: number,
): number {
  if (tiempoMaximoMin <= 0 || tiempoTotalRutaMin <= 0) return 0;
  if (tiempoTotalRutaMin > tiempoMaximoMin) return 0;

  const ratio = tiempoTotalRutaMin / tiempoMaximoMin;

  // Zona óptima de holgura razonable: 75% a 90%
  if (ratio >= 0.75 && ratio <= 0.90) {
    return 100;
  }

  // Por debajo de 75%: escala linealmente desde 0 hasta 100
  if (ratio < 0.75) {
    return Math.min(100, Math.max(0, (ratio / 0.75) * 100));
  }

  // Por encima de 90% (hasta 100%): ajustado de 100 a 90 por falta de holgura
  const exceso = (ratio - 0.90) / 0.10;
  return Math.max(0, 100 - exceso * 10);
}

/* ── 3. Compatibilidad Presupuestaria (20 %) ────────────────────────────── */

/**
 * Evalúa la compatibilidad del recorrido con el presupuesto disponible.
 * - No premia automáticamente un mayor gasto (gastar menos o ser gratuito es 100 % compatible).
 * - Si gasto_min y gasto_max existen en el contrato, se contemplan sin inventar valores ausentes.
 * - Un recorrido que apura el 100% del tope presupuestario recibe un leve descuento por riesgo (85 pts).
 */
export function calculateBudgetCompatibilityScore(
  paradas: PlanStop[],
  presupuestoMaximo: number,
): number {
  if (!paradas || paradas.length === 0) return 0;

  let totalMax = 0;
  let totalMin = 0;

  for (const p of paradas) {
    const minVal = p.place.gasto_min;
    const maxVal = p.place.gasto_max;

    const effMin = minVal !== null && minVal !== undefined ? minVal : (maxVal ?? 0);
    const effMax = maxVal !== null && maxVal !== undefined ? maxVal : (minVal ?? 0);

    totalMin += effMin;
    totalMax += effMax;
  }

  if (presupuestoMaximo <= 0) {
    return totalMax === 0 ? 100 : 0;
  }

  if (totalMax > presupuestoMaximo) {
    if (totalMin > presupuestoMaximo) return 0;
    // Si el mínimo cabe pero el máximo excede
    const exceso = (totalMax - presupuestoMaximo) / presupuestoMaximo;
    return Math.max(0, Math.min(50, 50 - exceso * 50));
  }

  // totalMax <= presupuestoMaximo: está holgadamente dentro del presupuesto
  // Si está cómodamente por debajo del 85% del presupuesto (incluyendo 0 gasto): 100 pts
  if (totalMax <= 0.85 * presupuestoMaximo) {
    return 100;
  }

  // Entre 85% y 100% del presupuesto: escala de 100 a 85 por cercanía al límite máximo
  const riesgo = (totalMax - 0.85 * presupuestoMaximo) / (0.15 * presupuestoMaximo);
  return Math.max(85, 100 - riesgo * 15);
}

/* ── 4. Eficiencia de Desplazamiento (20 %) ──────────────────────────────── */

/**
 * Evalúa la relación entre el tiempo de visita efectiva y el tiempo de traslado.
 * - Utiliza los minutos reales de traslado estimados (traslado_desde_anterior_min), no la distancia en km.
 * - Un recorrido donde al menos el 75% del tiempo se dedica a la visita efectiva obtiene 100 pts.
 */
export function calculateTravelEfficiencyScore(paradas: PlanStop[]): number {
  if (!paradas || paradas.length === 0) return 0;

  const tiempoVisita = paradas.reduce((acc, p) => acc + p.duracion_min, 0);
  const tiempoTraslado = paradas.reduce((acc, p) => acc + p.traslado_desde_anterior_min, 0);
  const tiempoTotal = tiempoVisita + tiempoTraslado;

  if (tiempoTotal <= 0) return 0;

  const ratioVisita = tiempoVisita / tiempoTotal;

  // Si al menos el 75% del tiempo es disfrute en paradas, es máxima eficiencia
  if (ratioVisita >= 0.75) {
    return 100;
  }

  return Math.min(100, Math.max(0, (ratioVisita / 0.75) * 100));
}

/* ── Evaluación Global Ponderada ────────────────────────────────────────── */

export interface ScoringParams {
  paradas: PlanStop[];
  interesesUsuario: string[];
  tiempoTotalMin: number;
  tiempoMaximoMin: number;
  presupuestoMaximo: number;
}

/**
 * Calcula el desglose y puntaje global normalizado (0–100) para un recorrido candidato.
 */
export function calculateMultiCriteriaScore(
  params: ScoringParams,
): MultiCriteriaScoreBreakdown {
  const cobertura = calculateInterestCoverageScore(params.paradas, params.interesesUsuario);
  const tiempo = calculateTimeUtilizationScore(params.tiempoTotalMin, params.tiempoMaximoMin);
  const presupuesto = calculateBudgetCompatibilityScore(params.paradas, params.presupuestoMaximo);
  const desplazamiento = calculateTravelEfficiencyScore(params.paradas);

  const total =
    PESOS_SCORING.coberturaIntereses * cobertura +
    PESOS_SCORING.aprovechamientoTiempo * tiempo +
    PESOS_SCORING.compatibilidadPresupuesto * presupuesto +
    PESOS_SCORING.eficienciaDesplazamiento * desplazamiento;

  return {
    coberturaIntereses: Math.round(cobertura * 10) / 10,
    aprovechamientoTiempo: Math.round(tiempo * 10) / 10,
    compatibilidadPresupuesto: Math.round(presupuesto * 10) / 10,
    eficienciaDesplazamiento: Math.round(desplazamiento * 10) / 10,
    scoreTotal: Math.round(total * 100) / 100,
  };
}
