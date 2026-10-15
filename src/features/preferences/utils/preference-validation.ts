export interface PreferenceFormValues {
  categoryIds: string[];
  gastoMin: number | null;
  gastoMax: number | null;
}

export type BudgetPresetKey = 'all' | 'economic' | 'moderate' | 'comfortable' | 'custom';

export interface BudgetPreset {
  key: BudgetPresetKey;
  label: string;
  min: number | null;
  max: number | null;
  description: string;
}

export const BUDGET_PRESETS: readonly BudgetPreset[] = [
  {
    key: 'all',
    label: 'Cualquiera',
    min: null,
    max: null,
    description: 'Sin restricción fija de presupuesto',
  },
  {
    key: 'economic',
    label: 'Económico',
    min: 0,
    max: 30,
    description: 'Hasta S/ 30 por salida',
  },
  {
    key: 'moderate',
    label: 'Moderado',
    min: 30,
    max: 80,
    description: 'Entre S/ 30 y S/ 80',
  },
  {
    key: 'comfortable',
    label: 'Holgado',
    min: 80,
    max: null,
    description: 'Desde S/ 80 a más',
  },
] as const;

export interface PreferenceValidationResult {
  isValid: boolean;
  errors: {
    categories?: string;
    gastoMin?: string;
    gastoMax?: string;
    budgetRange?: string;
  };
}

export interface ParseBudgetValueOptions {
  allowNull?: boolean;
}

export function parseBudgetValue(
  rawValue: string | number | null | undefined,
): number | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue === 'number') {
    if (Number.isNaN(rawValue)) return null;
    return rawValue;
  }

  const trimmed = rawValue.trim();
  if (trimmed === '') {
    return null;
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

export interface ValidatePreferenceParams {
  categoryIds: readonly string[];
  gastoMin: number | null;
  gastoMax: number | null;
  availableActiveCategoryIds?: readonly string[];
}

export function validatePreferencesForm({
  categoryIds,
  gastoMin,
  gastoMax,
  availableActiveCategoryIds,
}: ValidatePreferenceParams): PreferenceValidationResult {
  const errors: PreferenceValidationResult['errors'] = {};

  // Categorías
  if (!categoryIds || categoryIds.length === 0) {
    errors.categories = 'Selecciona al menos una categoría de interés.';
  } else if (availableActiveCategoryIds && availableActiveCategoryIds.length > 0) {
    const activeSet = new Set(availableActiveCategoryIds);
    const validActiveSelected = categoryIds.filter(id => activeSet.has(id));
    if (validActiveSelected.length === 0) {
      errors.categories = 'Selecciona al menos una categoría válida y activa.';
    }
  }

  // Presupuesto no negativo
  if (gastoMin !== null && gastoMin < 0) {
    errors.gastoMin = 'El gasto mínimo no puede ser negativo.';
  }

  if (gastoMax !== null && gastoMax < 0) {
    errors.gastoMax = 'El gasto máximo no puede ser negativo.';
  }

  // Rango coherente (gasto_min <= gasto_max)
  if (
    gastoMin !== null &&
    gastoMax !== null &&
    gastoMin >= 0 &&
    gastoMax >= 0 &&
    gastoMin > gastoMax
  ) {
    errors.budgetRange = 'El gasto mínimo no puede superar el gasto máximo.';
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
  };
}

export function matchBudgetPreset(
  min: number | null,
  max: number | null,
): BudgetPresetKey {
  if (min === null && max === null) return 'all';
  if (min === 0 && max === 30) return 'economic';
  if (min === 30 && max === 80) return 'moderate';
  if (min === 80 && max === null) return 'comfortable';
  return 'custom';
}
