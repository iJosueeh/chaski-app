import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';

import {
  clearActivePlan,
  getPlanStorageKeys,
  loadPlansStorage,
  PLAN_ACTIVO_STORAGE_KEY,
  PLAN_HISTORIAL_STORAGE_KEY,
  PLAN_VISITADAS_STORAGE_KEY,
  saveActivePlan,
  saveVisitedStops,
} from '../services/plans-storage.service';
import type { PlanHistorialEntry } from '../interfaces/plans.interface';

// Almacenamiento en memoria con mocks verificables.
vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      store,
      getItem: vi.fn((key: string) => Promise.resolve(store.has(key) ? store.get(key)! : null)),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
        return Promise.resolve();
      }),
      clear: vi.fn(() => {
        store.clear();
        return Promise.resolve();
      }),
    },
  };
});

const store = (AsyncStorage as unknown as { store: Map<string, string> }).store;

const USER_A = 'user-aaaa';
const USER_B = 'user-bbbb';
const keysA = getPlanStorageKeys(USER_A);
const keysB = getPlanStorageKeys(USER_B);

function makePlan(id = 'plan-1'): GeneratedPlan {
  return {
    id,
    titulo: 'Ruta Centro Histórico',
    descripcion: 'Expedición Serie AX',
    variante: 'equilibrado',
    paradas: [],
    duracion_total_min: 240,
    costo_total: 30,
    distancia_km_aprox: 3.2,
  };
}

function makeEntry(id = 'plan-1'): PlanHistorialEntry {
  return {
    ...makePlan(id),
    completado_en: '2026-10-15T12:00:00.000Z',
    paradas_visitadas: [1, 2],
    estado_expedicion: 'COMPLETADA',
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await AsyncStorage.clear();
});

describe('plans-storage.service — claves y estructura serializada (Serie AX)', () => {
  it('usa exactamente las claves históricas del plan como base', () => {
    expect(PLAN_ACTIVO_STORAGE_KEY).toBe('@chaski/plan_activo_v1');
    expect(PLAN_VISITADAS_STORAGE_KEY).toBe('@chaski/plan_visitadas_v1');
    expect(PLAN_HISTORIAL_STORAGE_KEY).toBe('@chaski/plan_historial_v1');
  });

  it('deriva claves únicas por usuario', () => {
    expect(keysA).toEqual({
      activo: `@chaski/plan_activo_v1:${USER_A}`,
      visitadas: `@chaski/plan_visitadas_v1:${USER_A}`,
      historial: `@chaski/plan_historial_v1:${USER_A}`,
    });
    expect(keysA.historial).not.toBe(keysB.historial);
  });

  it('saveActivePlan serializa el plan y reinicia visitadas (en ese orden)', async () => {
    const plan = makePlan();
    await saveActivePlan(USER_A, plan);

    expect(store.get(keysA.activo)).toBe(JSON.stringify(plan));
    expect(store.get(keysA.visitadas)).toBe('[]');

    const setItem = vi.mocked(AsyncStorage.setItem);
    expect(setItem).toHaveBeenNthCalledWith(1, keysA.activo, JSON.stringify(plan));
    expect(setItem).toHaveBeenNthCalledWith(2, keysA.visitadas, '[]');
  });

  it('saveVisitedStops persiste el arreglo de órdenes visitadas', async () => {
    await saveVisitedStops(USER_A, [1, 3]);

    expect(store.get(keysA.visitadas)).toBe('[1,3]');
    expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledWith(keysA.visitadas, '[1,3]');
  });

  it('clearActivePlan elimina el activo y reinicia visitadas (en ese orden)', async () => {
    await saveActivePlan(USER_A, makePlan());
    vi.clearAllMocks();

    await clearActivePlan(USER_A);

    const setItem = vi.mocked(AsyncStorage.setItem);
    const removeItem = vi.mocked(AsyncStorage.removeItem);
    expect(store.has(keysA.activo)).toBe(false);
    expect(store.get(keysA.visitadas)).toBe('[]');
    expect(removeItem).toHaveBeenCalledWith(keysA.activo);
    expect(setItem).toHaveBeenCalledWith(keysA.visitadas, '[]');
    expect(removeItem.mock.invocationCallOrder[0]).toBeLessThan(
      setItem.mock.invocationCallOrder[0],
    );
  });

  it('elimina las claves de historial obsoletas (legada global y del usuario)', async () => {
    store.set(PLAN_HISTORIAL_STORAGE_KEY, JSON.stringify([makeEntry()]));
    store.set(keysA.historial, JSON.stringify([makeEntry()]));

    await loadPlansStorage(USER_A);

    expect(store.has(PLAN_HISTORIAL_STORAGE_KEY)).toBe(false);
    expect(store.has(keysA.historial)).toBe(false);
  });
});

describe('plans-storage.service — restauración', () => {
  it('devuelve valores por defecto cuando no hay nada almacenado', async () => {
    await expect(loadPlansStorage(USER_A)).resolves.toEqual({
      planActivo: null,
      visitadas: [],
    });
  });

  it('hace roundtrip de un plan activo con su progreso', async () => {
    const plan = makePlan();
    await saveActivePlan(USER_A, plan);
    await saveVisitedStops(USER_A, [1]);

    await expect(loadPlansStorage(USER_A)).resolves.toEqual({
      planActivo: plan,
      visitadas: [1],
    });
  });

  it('conserva lo ya parseado ante un JSON corrupto (no bloquea la app)', async () => {
    const plan = makePlan();
    store.set(keysA.activo, JSON.stringify(plan));
    store.set(keysA.visitadas, 'no-es-json');

    await expect(loadPlansStorage(USER_A)).resolves.toEqual({
      planActivo: plan,
      visitadas: [],
    });
  });

  it('empieza limpio si el plan activo está corrupto', async () => {
    store.set(keysA.activo, '{corrupto');

    await expect(loadPlansStorage(USER_A)).resolves.toEqual({
      planActivo: null,
      visitadas: [],
    });
  });

  it('propaga el rechazo del propio AsyncStorage para que el llamador decida', async () => {
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage caído'));

    await expect(loadPlansStorage(USER_A)).rejects.toThrow('storage caído');
  });
});

describe('plans-storage.service — aislamiento entre cuentas', () => {
  it('los datos de una cuenta no son visibles para otra en el mismo dispositivo', async () => {
    const plan = makePlan();
    await saveActivePlan(USER_A, plan);
    await saveVisitedStops(USER_A, [1]);

    await expect(loadPlansStorage(USER_B)).resolves.toEqual({
      planActivo: null,
      visitadas: [],
    });
    await expect(loadPlansStorage(USER_A)).resolves.toEqual({
      planActivo: plan,
      visitadas: [1],
    });
  });

  it('clearActivePlan de una cuenta no afecta a otra', async () => {
    const planB = makePlan('plan-b');
    await saveActivePlan(USER_A, makePlan('plan-a'));
    await saveActivePlan(USER_B, planB);

    await clearActivePlan(USER_A);

    await expect(loadPlansStorage(USER_B)).resolves.toEqual({
      planActivo: planB,
      visitadas: [],
    });
  });
});

describe('plans-storage.service — migración de claves legadas sin usuario', () => {
  it('la primera cuenta que carga reclama activo y visitadas legados; el historial legado se elimina', async () => {
    const plan = makePlan();
    store.set(PLAN_ACTIVO_STORAGE_KEY, JSON.stringify(plan));
    store.set(PLAN_VISITADAS_STORAGE_KEY, JSON.stringify([1]));
    store.set(PLAN_HISTORIAL_STORAGE_KEY, JSON.stringify([makeEntry()]));

    await expect(loadPlansStorage(USER_A)).resolves.toEqual({
      planActivo: plan,
      visitadas: [1],
    });

    expect(store.has(PLAN_ACTIVO_STORAGE_KEY)).toBe(false);
    expect(store.has(PLAN_VISITADAS_STORAGE_KEY)).toBe(false);
    expect(store.get(keysA.activo)).toBe(JSON.stringify(plan));
    expect(store.has(PLAN_HISTORIAL_STORAGE_KEY)).toBe(false);
    expect(store.has(keysA.historial)).toBe(false);

    await expect(loadPlansStorage(USER_B)).resolves.toEqual({
      planActivo: null,
      visitadas: [],
    });
  });

  it('si el usuario ya tiene datos propios, el legado se descarta sin sobrescribir', async () => {
    const propio = makePlan('plan-propio');
    store.set(keysA.activo, JSON.stringify(propio));
    store.set(PLAN_ACTIVO_STORAGE_KEY, JSON.stringify(makePlan('plan-legado')));

    await expect(loadPlansStorage(USER_A)).resolves.toEqual({
      planActivo: propio,
      visitadas: [],
    });
    expect(store.has(PLAN_ACTIVO_STORAGE_KEY)).toBe(false);
  });
});
