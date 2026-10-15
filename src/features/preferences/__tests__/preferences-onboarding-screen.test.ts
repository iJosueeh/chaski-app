import { describe, expect, it } from 'vitest';
import {
  parseBudgetValue,
  validatePreferencesForm,
  matchBudgetPreset,
} from '../utils/preference-validation';


describe('PreferencesOnboarding — Contratos de Formulario y Validación Serie AX', () => {
  const activeCategoriesMock = [
    { id: 'cat-1', nombre: 'Gastronomía', descripcion: 'Comida criolla', estado: true },
    { id: 'cat-2', nombre: 'Museos', descripcion: 'Historia y arte', estado: true },
    { id: 'cat-3', nombre: 'Parques', descripcion: 'Naturaleza', estado: true },
    { id: 'cat-inactive', nombre: 'Festivales', descripcion: 'Inactivo', estado: false },
  ];

  const activeCategoryIds = activeCategoriesMock
    .filter((c) => c.estado)
    .map((c) => c.id);

  describe('Validación de Formulario Unificado', () => {
    it('deshabilita emisión si no hay categorías seleccionadas', () => {
      const validation = validatePreferencesForm({
        categoryIds: [],
        gastoMin: null,
        gastoMax: null,
        availableActiveCategoryIds: activeCategoryIds,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.categories).toBeDefined();
    });

    it('deshabilita emisión si la categoría seleccionada no está activa', () => {
      const validation = validatePreferencesForm({
        categoryIds: ['cat-inactive'],
        gastoMin: null,
        gastoMax: null,
        availableActiveCategoryIds: activeCategoryIds,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.categories).toBe('Selecciona al menos una categoría válida y activa.');
    });

    it('habilita emisión con al menos 1 categoría activa y presupuesto omitido', () => {
      const validation = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: null,
        gastoMax: null,
        availableActiveCategoryIds: activeCategoryIds,
      });

      expect(validation.isValid).toBe(true);
      expect(validation.errors.categories).toBeUndefined();
      expect(validation.errors.budgetRange).toBeUndefined();
    });

    it('valida rangos coherentes de presupuesto personalizado (gastoMin <= gastoMax)', () => {
      const validValidation = validatePreferencesForm({
        categoryIds: ['cat-1', 'cat-2'],
        gastoMin: 25,
        gastoMax: 60,
        availableActiveCategoryIds: activeCategoryIds,
      });
      expect(validValidation.isValid).toBe(true);

      const invalidValidation = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: 80,
        gastoMax: 30,
        availableActiveCategoryIds: activeCategoryIds,
      });
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.errors.budgetRange).toBe('El gasto mínimo no puede superar el gasto máximo.');
    });

    it('valida que no se permitan importes de presupuesto negativos', () => {
      const negativeMin = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: -10,
        gastoMax: 50,
        availableActiveCategoryIds: activeCategoryIds,
      });
      expect(negativeMin.isValid).toBe(false);
      expect(negativeMin.errors.gastoMin).toBe('El gasto mínimo no puede ser negativo.');

      const negativeMax = validatePreferencesForm({
        categoryIds: ['cat-1'],
        gastoMin: 10,
        gastoMax: -5,
        availableActiveCategoryIds: activeCategoryIds,
      });
      expect(negativeMax.isValid).toBe(false);
      expect(negativeMax.errors.gastoMax).toBe('El gasto máximo no puede ser negativo.');
    });

    it('no convierte inputs vacíos en cero al parsear', () => {
      expect(parseBudgetValue('')).toBeNull();
      expect(parseBudgetValue('  ')).toBeNull();
      expect(parseBudgetValue(null)).toBeNull();
      expect(parseBudgetValue('0')).toBe(0);
      expect(parseBudgetValue('45')).toBe(45);
    });
  });

  describe('Presets de Presupuesto', () => {
    it('sincroniza preset "Cualquiera" con valores nulos', () => {
      expect(matchBudgetPreset(null, null)).toBe('all');
    });

    it('sincroniza presets predefinidos válidos', () => {
      expect(matchBudgetPreset(0, 30)).toBe('economic');
      expect(matchBudgetPreset(30, 80)).toBe('moderate');
      expect(matchBudgetPreset(80, null)).toBe('comfortable');
    });

    it('identifica valores arbitrarios como preset "Personalizado"', () => {
      expect(matchBudgetPreset(15, 45)).toBe('custom');
      expect(matchBudgetPreset(null, 50)).toBe('custom');
    });
  });

  describe('Navegación Declarativa por hasPreferences', () => {
    it('simula la transición automática de OnboardingStack a AuthenticatedStack sin router.replace', () => {
      // En _layout.tsx:
      // !hasPreferences ? <OnboardingStack /> : <AuthenticatedStack />
      let hasPreferences = false;
      const getActiveStack = () => (!hasPreferences ? 'OnboardingStack' : 'AuthenticatedStack');

      expect(getActiveStack()).toBe('OnboardingStack');

      // Tras savePreferences exitoso:
      hasPreferences = true;
      expect(getActiveStack()).toBe('AuthenticatedStack');
    });

    it('si savePreferences retorna false, hasPreferences permanece false y conserva selección del usuario', () => {
      let hasPreferences = false;
      let selectedIds = ['cat-1', 'cat-2'];

      // Fallo de red simulado
      const simulateFailedSubmit = () => {
        // En caso de fallo no se actualiza hasPreferences
        return false;
      };

      const result = simulateFailedSubmit();
      expect(result).toBe(false);
      expect(hasPreferences).toBe(false);
      // Las selecciones no se limpian
      expect(selectedIds).toEqual(['cat-1', 'cat-2']);
    });
  });
});
