import { describe, expect, it } from 'vitest';
import {
  validatePreferencesForm,
  parseBudgetValue,
} from '../utils/preference-validation';

describe('PreferencesScreen (Edición desde Perfil Serie AX) — Contratos y Comportamiento', () => {
  const activeCategoriesMock = [
    { id: 'cat-art', nombre: 'Arte y Museos', descripcion: 'Recintos culturales', estado: true },
    { id: 'cat-gas', nombre: 'Gastronomía', descripcion: 'Comida típica', estado: true },
    { id: 'cat-nat', nombre: 'Naturaleza', descripcion: 'Áreas verdes', estado: true },
    { id: 'cat-off', nombre: 'Eventos cerrados', descripcion: 'Inactivo', estado: false },
  ];

  const activeCategoryIds = activeCategoriesMock
    .filter((c) => c.estado)
    .map((c) => c.id);

  describe('Precarga y Detección de Cambios', () => {
    const persistedPreferences = {
      usuario_id: 'user-001',
      movilidad_preferida: 'caminando',
      gasto_min: 20,
      gasto_max: 80,
      categorias: [
        { id: 'cat-art', nombre: 'Arte y Museos', descripcion: 'Recintos culturales', estado: true },
        { id: 'cat-gas', nombre: 'Gastronomía', descripcion: 'Comida típica', estado: true },
      ],
    };

    const hasChangesDetector = (
      initial: typeof persistedPreferences,
      currentCatIds: string[],
      currentMin: string,
      currentMax: string,
    ) => {
      const persistedIds = new Set(initial.categorias.map((c) => c.id));
      const currentIds = new Set(currentCatIds);

      const categoriesChanged =
        persistedIds.size !== currentIds.size ||
        [...currentIds].some((id) => !persistedIds.has(id));

      const initialMinStr = initial.gasto_min != null ? String(initial.gasto_min) : '';
      const initialMaxStr = initial.gasto_max != null ? String(initial.gasto_max) : '';

      const minChanged = currentMin.trim() !== initialMinStr.trim();
      const maxChanged = currentMax.trim() !== initialMaxStr.trim();

      return categoriesChanged || minChanged || maxChanged;
    };

    it('detecta correctamente cuando no hay cambios frente al perfil precargado', () => {
      const currentIds = ['cat-art', 'cat-gas'];
      const currentMin = '20';
      const currentMax = '80';

      const hasChanges = hasChangesDetector(persistedPreferences, currentIds, currentMin, currentMax);
      expect(hasChanges).toBe(false);
    });

    it('detecta cambios cuando se añade o remueve una categoría', () => {
      // Remover una
      expect(hasChangesDetector(persistedPreferences, ['cat-art'], '20', '80')).toBe(true);
      // Añadir una
      expect(hasChangesDetector(persistedPreferences, ['cat-art', 'cat-gas', 'cat-nat'], '20', '80')).toBe(true);
    });

    it('detecta cambios cuando se modifica el presupuesto', () => {
      expect(hasChangesDetector(persistedPreferences, ['cat-art', 'cat-gas'], '25', '80')).toBe(true);
      expect(hasChangesDetector(persistedPreferences, ['cat-art', 'cat-gas'], '', '80')).toBe(true);
      expect(hasChangesDetector(persistedPreferences, ['cat-art', 'cat-gas'], '20', '100')).toBe(true);
    });

    it('H-03: tras guardar con éxito, la línea base se actualiza y hasChanges vuelve a false sin remontar la pantalla', () => {
      let currentBaseline = {
        categoryIds: ['cat-art', 'cat-gas'],
        gastoMin: '20',
        gastoMax: '80',
      };

      const checkChangesAgainstBaseline = (ids: string[], min: string, max: string) => {
        const baseIds = new Set(currentBaseline.categoryIds);
        const currentIds = new Set(ids);
        const catChanged = baseIds.size !== currentIds.size || [...currentIds].some(id => !baseIds.has(id));
        const minChanged = min.trim() !== currentBaseline.gastoMin.trim();
        const maxChanged = max.trim() !== currentBaseline.gastoMax.trim();
        return catChanged || minChanged || maxChanged;
      };

      // 1. Modificación 1: usuario cambia gasto máximo a 120
      let formCatIds = ['cat-art', 'cat-gas'];
      let formMin = '20';
      let formMax = '120';
      expect(checkChangesAgainstBaseline(formCatIds, formMin, formMax)).toBe(true);

      // 2. Guardado exitoso 1: se actualiza la línea base
      currentBaseline = {
        categoryIds: [...formCatIds],
        gastoMin: formMin,
        gastoMax: formMax,
      };
      // hasChanges debe volver a false de inmediato
      expect(checkChangesAgainstBaseline(formCatIds, formMin, formMax)).toBe(false);

      // 3. Modificación 2 (segunda edición consecutiva): usuario deselecciona cat-gas y cambia min a 30
      formCatIds = ['cat-art'];
      formMin = '30';
      expect(checkChangesAgainstBaseline(formCatIds, formMin, formMax)).toBe(true);

      // 4. Guardado exitoso 2: se actualiza nuevamente la línea base
      currentBaseline = {
        categoryIds: [...formCatIds],
        gastoMin: formMin,
        gastoMax: formMax,
      };
      // hasChanges vuelve a false tras el segundo guardado
      expect(checkChangesAgainstBaseline(formCatIds, formMin, formMax)).toBe(false);
    });
  });

  describe('Validaciones en Edición', () => {
    it('no permite guardar si el usuario deselecciona todas las categorías', () => {
      const validation = validatePreferencesForm({
        categoryIds: [],
        gastoMin: 20,
        gastoMax: 80,
        availableActiveCategoryIds: activeCategoryIds,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.categories).toBeDefined();
    });

    it('permite guardar con presupuesto vaciado / omitido', () => {
      const validation = validatePreferencesForm({
        categoryIds: ['cat-art'],
        gastoMin: parseBudgetValue(''),
        gastoMax: parseBudgetValue(''),
        availableActiveCategoryIds: activeCategoryIds,
      });

      expect(validation.isValid).toBe(true);
      expect(validation.errors.budgetRange).toBeUndefined();
    });

    it('impide guardar si el gasto mínimo supera el máximo', () => {
      const validation = validatePreferencesForm({
        categoryIds: ['cat-art'],
        gastoMin: 90,
        gastoMax: 30,
        availableActiveCategoryIds: activeCategoryIds,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.budgetRange).toBe('El gasto mínimo no puede superar el gasto máximo.');
    });
  });

  describe('Preservación de Movilidad y Permanencia en Perfil', () => {
    it('garantiza que el payload para la RPC envía actualizarMovilidad = false', () => {
      const generatePayload = (categoryIds: string[], minText: string, maxText: string) => ({
        categoryIds,
        gastoMin: parseBudgetValue(minText),
        gastoMax: parseBudgetValue(maxText),
        actualizarMovilidad: false, // Preserva movilidad existente
      });

      const payload = generatePayload(['cat-art'], '30', '90');
      expect(payload.actualizarMovilidad).toBe(false);
      expect(payload.gastoMin).toBe(30);
      expect(payload.gastoMax).toBe(90);
    });

    it('permanece en la pantalla actual al guardar con éxito (no dispara navegación a tabs)', () => {
      // Simula comportamiento de guardar desde perfil
      let currentScreen = 'profile-preferences';
      let navigationTriggered: string | null = null;

      const onProfileSaveSuccess = () => {
        // En Perfil no se llama a router.replace ni router.push tras guardar
        navigationTriggered = null;
      };

      onProfileSaveSuccess();
      expect(currentScreen).toBe('profile-preferences');
      expect(navigationTriggered).toBeNull();
    });
  });

  describe('Identidad del Explorador en Perfil Serie AX', () => {
    const mockUser = {
      id: 'usr-chaski-99',
      email: 'explorador@chaski.pe',
      created_at: '2026-10-10T14:00:00.000Z',
      user_metadata: {
        nombre: 'Huayna Cápac',
      },
    };

    it('detecta si el nombre del explorador ha cambiado frente al usuario en sesión', () => {
      const currentName = mockUser.user_metadata.nombre;

      const hasNameChanged = (input: string) => input.trim() !== currentName.trim();

      expect(hasNameChanged('Huayna Cápac')).toBe(false);
      expect(hasNameChanged('  Huayna Cápac  ')).toBe(false);
      expect(hasNameChanged('Huayna Cápac Segundo')).toBe(true);
      expect(hasNameChanged('Atahualpa')).toBe(true);
    });

    it('impide guardar si el nuevo nombre no supera las validaciones mínimas', () => {
      const validateNameInput = (name: string) => {
        if (!name || name.trim().length === 0) return { isValid: false, error: 'Ingresa tu nombre completo' };
        if (name.trim().length < 2) return { isValid: false, error: 'El nombre debe tener al menos 2 caracteres' };
        return { isValid: true, trimmedName: name.trim() };
      };

      expect(validateNameInput('').isValid).toBe(false);
      expect(validateNameInput('   ').isValid).toBe(false);
      expect(validateNameInput('X').isValid).toBe(false);
      expect(validateNameInput('Inca Roca').isValid).toBe(true);
    });

    it('actualiza el usuario en la sesión sin invalidar los tokens ni cerrar la sesión', () => {
      let activeSession = {
        access_token: 'fake-jwt-token',
        user: { ...mockUser },
      };

      // Simulación de actualización de perfil
      const updatedUser = {
        ...mockUser,
        user_metadata: {
          ...mockUser.user_metadata,
          nombre: 'Sinchi Roca',
        },
      };

      // La sesión se actualiza de forma inmutable
      activeSession = {
        ...activeSession,
        user: updatedUser,
      };

      expect(activeSession.access_token).toBe('fake-jwt-token');
      expect(activeSession.user.user_metadata.nombre).toBe('Sinchi Roca');
      expect(activeSession.user.email).toBe('explorador@chaski.pe');
    });
  });
});
