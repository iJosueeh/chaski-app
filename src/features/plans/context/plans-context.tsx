/**
 * PlansContext — el ciclo de vida del plan del usuario.
 *
 * Estados (máquina según docs de Josué):
 *   ACTIVO (en curso)  -> COMPLETADO -> archivado en historial
 *
 * Persistencia: AsyncStorage (sobrevive a cierres de la app).
 * Un solo plan activo a la vez; al completar se archiva con fecha.
 * `visitadas` = órdenes de parada ya marcadas como completadas.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';

export type PlanHistorialEntry = GeneratedPlan & {
  completado_en: string; // ISO date
};

interface PlansContextValue {
  planActivo: GeneratedPlan | null;
  /** Órdenes de parada ya visitadas (progreso real del recorrido). */
  visitadas: number[];
  historial: PlanHistorialEntry[];
  loading: boolean;
  activarPlan: (plan: GeneratedPlan) => Promise<void>;
  marcarParada: (orden: number) => void;
  paradaVisitada: (orden: number) => boolean;
  completarPlan: () => Promise<void>;
  cancelarPlan: () => Promise<void>;
  limpiarHistorial: () => Promise<void>;
}

const KEY_ACTIVO = '@chaski/plan_activo_v1';
const KEY_VISITADAS = '@chaski/plan_visitadas_v1';
const KEY_HISTORIAL = '@chaski/plan_historial_v1';

const PlansContext = createContext<PlansContextValue | null>(null);

export function PlansProvider({ children }: { children: ReactNode }) {
  const [planActivo, setPlanActivo] = useState<GeneratedPlan | null>(null);
  const [visitadas, setVisitadas] = useState<number[]>([]);
  const [historial, setHistorial] = useState<PlanHistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar al iniciar
  useEffect(() => {
    (async () => {
      try {
        const [a, v, h] = await Promise.all([
          AsyncStorage.getItem(KEY_ACTIVO),
          AsyncStorage.getItem(KEY_VISITADAS),
          AsyncStorage.getItem(KEY_HISTORIAL),
        ]);
        if (a) setPlanActivo(JSON.parse(a));
        if (v) setVisitadas(JSON.parse(v));
        if (h) setHistorial(JSON.parse(h));
      } catch {
        // almacenamiento corrupto: empezar limpio (no bloquear la app)
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activarPlan = useCallback(async (plan: GeneratedPlan) => {
    setPlanActivo(plan);
    setVisitadas([]);
    await AsyncStorage.setItem(KEY_ACTIVO, JSON.stringify(plan));
    await AsyncStorage.setItem(KEY_VISITADAS, JSON.stringify([]));
  }, []);

  const marcarParada = useCallback((orden: number) => {
    setVisitadas((prev) => {
      const n = prev.includes(orden)
        ? prev.filter((o) => o !== orden)
        : [...prev, orden];
      AsyncStorage.setItem(KEY_VISITADAS, JSON.stringify(n));
      return n;
    });
  }, []);

  const paradaVisitada = useCallback(
    (orden: number) => visitadas.includes(orden),
    [visitadas],
  );

  const completarPlan = useCallback(async () => {
    if (!planActivo) return;
    const entry: PlanHistorialEntry = {
      ...planActivo,
      completado_en: new Date().toISOString(),
    };
    const nuevo = [entry, ...historial];
    setHistorial(nuevo);
    setPlanActivo(null);
    setVisitadas([]);
    await AsyncStorage.setItem(KEY_HISTORIAL, JSON.stringify(nuevo));
    await AsyncStorage.removeItem(KEY_ACTIVO);
    await AsyncStorage.setItem(KEY_VISITADAS, JSON.stringify([]));
  }, [planActivo, historial]);

  const cancelarPlan = useCallback(async () => {
    setPlanActivo(null);
    setVisitadas([]);
    await AsyncStorage.removeItem(KEY_ACTIVO);
    await AsyncStorage.setItem(KEY_VISITADAS, JSON.stringify([]));
  }, []);

  const limpiarHistorial = useCallback(async () => {
    setHistorial([]);
    await AsyncStorage.removeItem(KEY_HISTORIAL);
  }, []);

  const value = useMemo<PlansContextValue>(
    () => ({
      planActivo,
      visitadas,
      historial,
      loading,
      activarPlan,
      marcarParada,
      paradaVisitada,
      completarPlan,
      cancelarPlan,
      limpiarHistorial,
    }),
    [
      planActivo,
      visitadas,
      historial,
      loading,
      activarPlan,
      marcarParada,
      paradaVisitada,
      completarPlan,
      cancelarPlan,
      limpiarHistorial,
    ],
  );

  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>;
}

export function usePlans(): PlansContextValue {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error('usePlans debe usarse dentro de <PlansProvider>');
  return ctx;
}
