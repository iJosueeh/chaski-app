import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/features/auth/context/auth-context';
import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';

import type { EstadoExpedicion, PlanHistorialEntry } from '../interfaces/plans.interface';
import { guardarExpedicion } from '../services/expediciones-plan.service';
import {
  clearActivePlan,
  loadPlansStorage,
  saveActivePlan,
  saveVisitedStops,
} from '../services/plans-storage.service';

export type { EstadoExpedicion, PlanHistorialEntry };

interface PlansContextValue {
  planActivo: GeneratedPlan | null;
  visitadas: number[];
  historial: PlanHistorialEntry[];
  loading: boolean;
  activarPlan: (plan: GeneratedPlan) => Promise<void>;
  marcarParada: (orden: number) => void;
  paradaVisitada: (orden: number) => boolean;
  completarPlan: () => Promise<void>;
  abandonarPlan: () => Promise<void>;
  cancelarPlan: () => Promise<void>;
  limpiarHistorial: () => Promise<void>;
}

const PlansContext = createContext<PlansContextValue | null>(null);

export function PlansProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [planActivo, setPlanActivo] = useState<GeneratedPlan | null>(null);
  const [visitadas, setVisitadas] = useState<number[]>([]);
  const [historial, setHistorial] = useState<PlanHistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const activeUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    activeUserIdRef.current = userId;
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlanActivo(null);
    setVisitadas([]);
    setHistorial([]);

    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadPlansStorage(userId)
      .then((snapshot) => {
        if (cancelled || activeUserIdRef.current !== userId) return;
        setPlanActivo(snapshot.planActivo);
        setVisitadas(snapshot.visitadas);
      })
      .catch(() => {
      })
      .finally(() => {
        if (cancelled || activeUserIdRef.current !== userId) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const activarPlan = useCallback(async (plan: GeneratedPlan) => {
    setPlanActivo(plan);
    setVisitadas([]);
    if (userId) {
      await saveActivePlan(userId, plan);
    }
  }, [userId]);

  const marcarParada = useCallback((orden: number) => {
    setVisitadas((prev) => {
      const n = prev.includes(orden)
        ? prev.filter((o) => o !== orden)
        : [...prev, orden];
      if (userId) saveVisitedStops(userId, n);
      return n;
    });
  }, [userId]);

  const paradaVisitada = useCallback(
    (orden: number) => visitadas.includes(orden),
    [visitadas],
  );

  const completarPlan = useCallback(async () => {
    if (!planActivo) return;
    const totalParadas = planActivo.paradas?.length ?? 0;
    const visitadasCount = visitadas.length;
    const estado_expedicion: EstadoExpedicion =
      totalParadas > 0 && visitadasCount >= totalParadas ? 'COMPLETADA' : 'PARCIAL';

    const paradas_visitadas_ids = (planActivo.paradas ?? [])
      .filter((s) => visitadas.includes(s.orden))
      .map((s) => s.place?.id)
      .filter((id): id is string => Boolean(id));

    const entry: PlanHistorialEntry = {
      ...planActivo,
      completado_en: new Date().toISOString(),
      paradas_visitadas: [...visitadas],
      paradas_visitadas_ids,
      estado_expedicion,
    };
    const nuevo = [entry, ...historial];
    setHistorial(nuevo);
    setPlanActivo(null);
    setVisitadas([]);
    if (userId) {
      await clearActivePlan(userId);
    }
    if (userId && planActivo.solicitud_id) {
      guardarExpedicion({
        solicitudId: planActivo.solicitud_id,
        usuarioId: userId,
        estadoExpedicion: estado_expedicion,
        completadoEn: entry.completado_en,
        planSnapshot: planActivo,
        paradasVisitadas: [...visitadas],
        paradasVisitadasIds: paradas_visitadas_ids,
      });
    }
  }, [planActivo, visitadas, historial, userId]);

  const abandonarPlan = useCallback(async () => {
    if (!planActivo) return;
    const paradas_visitadas_ids = (planActivo.paradas ?? [])
      .filter((s) => visitadas.includes(s.orden))
      .map((s) => s.place?.id)
      .filter((id): id is string => Boolean(id));

    const entry: PlanHistorialEntry = {
      ...planActivo,
      completado_en: new Date().toISOString(),
      paradas_visitadas: [...visitadas],
      paradas_visitadas_ids,
      estado_expedicion: 'ABANDONADA',
    };
    const nuevo = [entry, ...historial];
    setHistorial(nuevo);
    setPlanActivo(null);
    setVisitadas([]);
    if (userId) {
      await clearActivePlan(userId);
    }
    if (userId && planActivo.solicitud_id) {
      guardarExpedicion({
        solicitudId: planActivo.solicitud_id,
        usuarioId: userId,
        estadoExpedicion: 'ABANDONADA',
        completadoEn: entry.completado_en,
        planSnapshot: planActivo,
        paradasVisitadas: [...visitadas],
        paradasVisitadasIds: paradas_visitadas_ids,
      });
    }
  }, [planActivo, visitadas, historial, userId]);

  const cancelarPlan = useCallback(async () => {
    await abandonarPlan();
  }, [abandonarPlan]);

  const limpiarHistorial = useCallback(async () => {
    setHistorial([]);
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
      abandonarPlan,
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
      abandonarPlan,
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
