import { describe, expect, it } from 'vitest';
import {
  BUDGET_PRESETS,
  matchBudgetPreset,
  parseBudgetValue,
  validatePreferencesForm,
  type BudgetPreset,
} from '../utils/preference-validation';

describe('Preferencias de Usuario — Validaciones y Contratos (Serie AX)', () => {
  describe('parseBudgetValue', () => {
    it('retorna null para null, undefined o cadenas vacías', () => {
      expect(parseBudgetValue(null)).toBeNull();
      expect(parseBudgetValue(undefined)).toBeNull();
      expect(parseBudgetValue('')).toBeNull();
      expect(parseBudgetValue('   ')).toBeNull();
    });

    it('no convierte cadenas vacías en 0', () => {
      const parsedEmpty = parseBudgetValue('');
      expect(parsedEmpty).toBeNull();
      expect(parsedEmpty).not.toBe(0);
    });

    it('parsea correctamente cadenas numéricas y números', () => {
      expect(parseBudgetValue('0')).toBe(0);
      expect(parseBudgetValue('25')).toBe(25);
      expect(parseBudgetValue('50.5')).toBe(50.5);
      expect(parseBudgetValue(100)).toBe(100);
      expect(parseBudgetValue(0)).toBe(0);
    });

    it('retorna null para valores no numéricos', () => {
      expect(parseBudgetValue('abc')).toBeNull();
      expect(parseBudgetValue('s/ 50')).toBeNull();
      expect(parseBudgetValue(NaN)).toBeNull();
    });
  });

  describe('validatePreferencesForm — Categorías', () => {
    it('falla si la lista de categorías está vacía', () => {
      const result = validatePreferencesForm({
        categoryIds: [],
        gastoMin: null,
        gastoMax: null,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.categories).toBeDefined();
    });

    it('pasa si tiene al menos una categoría seleccionada sin lista de activas', () => {
      const result = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: null,
        gastoMax: null,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors.categories).toBeUndefined();
    });

    it('valida que las categorías seleccionadas pertenezcan a la lista de activas', () => {
      const activeIds = ['cat-1', 'cat-2', 'cat-3'];

      const invalidResult = validatePreferencesForm({
        categoryIds: ['cat-inactive-99'],
        gastoMin: null,
        gastoMax: null,
        availableActiveCategoryIds: activeIds,
      });
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.categories).toBeDefined();

      const validResult = validatePreferencesForm({
        categoryIds: ['cat-2'],
        gastoMin: null,
        gastoMax: null,
        availableActiveCategoryIds: activeIds,
      });
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors.categories).toBeUndefined();
    });
  });

  describe('validatePreferencesForm — Presupuesto Opcional', () => {
    it('permite presupuesto totalmente omitido (ambos null)', () => {
      const result = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: null,
        gastoMax: null,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors.gastoMin).toBeUndefined();
      expect(result.errors.gastoMax).toBeUndefined();
      expect(result.errors.budgetRange).toBeUndefined();
    });

    it('permite solo gastoMin o solo gastoMax definidos', () => {
      const resultOnlyMin = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: 50,
        gastoMax: null,
      });
      expect(resultOnlyMin.isValid).toBe(true);

      const resultOnlyMax = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: null,
        gastoMax: 100,
      });
      expect(resultOnlyMax.isValid).toBe(true);
    });

    it('falla si algún valor es negativo', () => {
      const resultNegativeMin = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: -10,
        gastoMax: 50,
      });
      expect(resultNegativeMin.isValid).toBe(false);
      expect(resultNegativeMin.errors.gastoMin).toBeDefined();

      const resultNegativeMax = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: 10,
        gastoMax: -5,
      });
      expect(resultNegativeMax.isValid).toBe(false);
      expect(resultNegativeMax.errors.gastoMax).toBeDefined();
    });

    it('falla si gastoMin > gastoMax cuando ambos están presentes', () => {
      const result = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: 100,
        gastoMax: 50,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.budgetRange).toBe('El gasto mínimo no puede superar el gasto máximo.');
    });

    it('acepta gastoMin === gastoMax (presupuesto exacto)', () => {
      const result = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: 50,
        gastoMax: 50,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors.budgetRange).toBeUndefined();
    });

    it('acepta gastoMin < gastoMax válidos', () => {
      const result = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: 20,
        gastoMax: 80,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors.budgetRange).toBeUndefined();
    });
  });

  describe('Presets de Presupuesto', () => {
    it('identifica correctamente los presets definidos', () => {
      expect(matchBudgetPreset(null, null)).toBe('all');
      expect(matchBudgetPreset(0, 30)).toBe('economic');
      expect(matchBudgetPreset(30, 80)).toBe('moderate');
      expect(matchBudgetPreset(80, null)).toBe('comfortable');
      expect(matchBudgetPreset(10, 50)).toBe('custom');
      expect(matchBudgetPreset(null, 50)).toBe('custom');
    });

    it('todos los presets predefinidos cumplen con la regla de validación gastoMin <= gastoMax', () => {
      BUDGET_PRESETS.forEach((preset: BudgetPreset) => {
        const result = validatePreferencesForm({
          categoryIds: ['cat-1'],
          gastoMin: preset.min,
          gastoMax: preset.max,
        });
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Contrato SavePreferencesRequest con Supabase', () => {
    it('garantiza compatibilidad del payload con el servicio existente', () => {
      const formState = {
        categoryIds: ['cat-1', 'cat-2'],
        gastoMin: parseBudgetValue('25'),
        gastoMax: parseBudgetValue('75'),
      };

      const requestPayload = {
        userId: 'test-user-id',
        movilidadPreferida: null,
        gastoMin: formState.gastoMin,
        gastoMax: formState.gastoMax,
        categoryIds: formState.categoryIds,
      };

      expect(requestPayload.userId).toBe('test-user-id');
      expect(requestPayload.movilidadPreferida).toBeNull();
      expect(requestPayload.gastoMin).toBe(25);
      expect(requestPayload.gastoMax).toBe(75);
      expect(requestPayload.categoryIds).toHaveLength(2);
    });
  });
});
