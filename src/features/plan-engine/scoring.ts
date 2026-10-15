import type { PlanStop } from './plan-engine';
import { mapInterestsToCategories } from './viability';

export interface MultiCriteriaScoreBreakdown {
  coberturaIntereses: number;
  aprovechamientoTiempo: number;
  compatibilidadPresupuesto: number;
  eficienciaDesplazamiento: number;
  scoreTotal: number;
}

export const PESOS_SCORING = {
  coberturaIntereses: 0.35,
  aprovechamientoTiempo: 0.25,
  compatibilidadPresupuesto: 0.20,
  eficienciaDesplazamiento: 0.20,
} as const;

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

  const exceso = (ratio - 0.90) / 0.10;
  return Math.max(0, 100 - exceso * 10);
}

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
    const exceso = (totalMax - presupuestoMaximo) / presupuestoMaximo;
    return Math.max(0, Math.min(50, 50 - exceso * 50));
  }

  if (totalMax <= 0.85 * presupuestoMaximo) {
    return 100;
  }

  // Entre 85% y 100% del presupuesto: escala de 100 a 85 por cercanía al límite máximo
  const riesgo = (totalMax - 0.85 * presupuestoMaximo) / (0.15 * presupuestoMaximo);
  return Math.max(85, 100 - riesgo * 15);
}

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

export interface ScoringParams {
  paradas: PlanStop[];
  interesesUsuario: string[];
  tiempoTotalMin: number;
  tiempoMaximoMin: number;
  presupuestoMaximo: number;
}

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
