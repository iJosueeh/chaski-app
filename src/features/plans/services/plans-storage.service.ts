/**
 * Persistencia local del ciclo de vida del plan (Serie AX).
 *
 * Único punto de acceso a AsyncStorage para Plans: claves, estructura
 * serializada y semántica de restauración idénticas a las que el contexto
 * usaba inline. El contexto decide el estado; aquí solo se leen/escriben
 * bytes.
 *
 * Claves (no renombrar: los usuarios tienen datos persistidos con ellas):
 * - '@chaski/plan_activo_v1:{userId}'  → GeneratedPlan (JSON)
 * - '@chaski/plan_visitadas_v1:{userId}' → number[]   (JSON)
 *
 * La clave histórica '@chaski/plan_historial_v1' quedó obsoleta: el historial
 * ya no se persiste localmente (la pestaña «Mis Exploraciones» consulta
 * `solicitudes_plan` en Supabase) y se elimina en cada carga.
 *
 * Las claves legadas sin usuario existentes en instalaciones antiguas se
 * reclaman en la primera carga: si el usuario aún no tiene datos propios,
 * hereda los del dispositivo; en caso contrario se descartan. En cualquier
 * caso, la clave legada se elimina para que ningún otra cuenta los vea.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';

export const PLAN_ACTIVO_STORAGE_KEY = '@chaski/plan_activo_v1';
export const PLAN_VISITADAS_STORAGE_KEY = '@chaski/plan_visitadas_v1';
export const PLAN_HISTORIAL_STORAGE_KEY = '@chaski/plan_historial_v1';

export function getPlanStorageKeys(userId: string) {
  return {
    activo: `${PLAN_ACTIVO_STORAGE_KEY}:${userId}`,
    visitadas: `${PLAN_VISITADAS_STORAGE_KEY}:${userId}`,
    historial: `${PLAN_HISTORIAL_STORAGE_KEY}:${userId}`,
  };
}

/** Snapshot restaurado del almacenamiento local. */
export type PlansStorageSnapshot = {
  planActivo: GeneratedPlan | null;
  visitadas: number[];
};

function parseSnapshot(
  rawActivo: string | null,
  rawVisitadas: string | null,
): PlansStorageSnapshot {
  const snapshot: PlansStorageSnapshot = {
    planActivo: null,
    visitadas: [],
  };

  try {
    if (rawActivo) snapshot.planActivo = JSON.parse(rawActivo);
    if (rawVisitadas) snapshot.visitadas = JSON.parse(rawVisitadas);
  } catch {
    // JSON corrupto: se conserva lo ya parseado; el resto queda por defecto.
  }

  return snapshot;
}

async function claimLegacyKey(legacyKey: string, scopedKey: string): Promise<void> {
  const legacyRaw = await AsyncStorage.getItem(legacyKey);
  if (legacyRaw === null) return;

  const scopedRaw = await AsyncStorage.getItem(scopedKey);
  if (scopedRaw === null) {
    await AsyncStorage.setItem(scopedKey, legacyRaw);
  }
  await AsyncStorage.removeItem(legacyKey);
}

async function purgeObsoleteHistorialKeys(userId: string): Promise<void> {
  const keys = getPlanStorageKeys(userId);
  await AsyncStorage.removeItem(PLAN_HISTORIAL_STORAGE_KEY);
  await AsyncStorage.removeItem(keys.historial);
}

/**
 * Restaura el ciclo de vida del plan desde AsyncStorage.
 *
 * Semántica histórica conservada:
 * - Un almacenamiento corrupto no bloquea la app: al primer JSON inválido se
 *   conserva lo ya parseado y el resto queda en sus valores por defecto.
 * - Un fallo del propio AsyncStorage (rechazo) se propaga; el llamador decide
 *   (el contexto empieza limpio).
 */
export async function loadPlansStorage(userId: string): Promise<PlansStorageSnapshot> {
  const keys = getPlanStorageKeys(userId);

  await claimLegacyKey(PLAN_ACTIVO_STORAGE_KEY, keys.activo);
  await claimLegacyKey(PLAN_VISITADAS_STORAGE_KEY, keys.visitadas);
  await purgeObsoleteHistorialKeys(userId);

  const [rawActivo, rawVisitadas] = await Promise.all([
    AsyncStorage.getItem(keys.activo),
    AsyncStorage.getItem(keys.visitadas),
  ]);

  return parseSnapshot(rawActivo, rawVisitadas);
}

/** Persiste el plan activo y reinicia el progreso de paradas visitadas. */
export async function saveActivePlan(userId: string, plan: GeneratedPlan): Promise<void> {
  const keys = getPlanStorageKeys(userId);
  await AsyncStorage.setItem(keys.activo, JSON.stringify(plan));
  await AsyncStorage.setItem(keys.visitadas, JSON.stringify([]));
}

/** Persiste el progreso de paradas visitadas. */
export async function saveVisitedStops(userId: string, visitadas: number[]): Promise<void> {
  const keys = getPlanStorageKeys(userId);
  await AsyncStorage.setItem(keys.visitadas, JSON.stringify(visitadas));
}

export async function clearActivePlan(userId: string): Promise<void> {
  const keys = getPlanStorageKeys(userId);
  await AsyncStorage.removeItem(keys.activo);
  await AsyncStorage.setItem(keys.visitadas, JSON.stringify([]));
}
