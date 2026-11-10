/**
 * Hook de la auditoría de intendencia (Fase 1.5 · APF3).
 *
 * Trae en paralelo el historial de acciones y los números de uso. El historial
 * se pagina de a bloques: la base devuelve el total junto con la página, así
 * que no hace falta una llamada extra para saber cuántas páginas hay.
 */

import { useCallback, useEffect, useState } from 'react';

import type {
  AdminAccion,
  AdminBusinessMetrics,
} from '../interfaces/admin.interface';
import {
  fetchAdminAcciones,
  fetchAdminBusinessMetrics,
} from '../services/admin.service';

/** Cuántas acciones se piden por página. */
export const AUDIT_PAGE_SIZE = 15;

export interface UseAdminAuditoriaResult {
  acciones: AdminAccion[];
  metrics: AdminBusinessMetrics | null;
  totalCount: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
}

export function useAdminAuditoria(): UseAdminAuditoriaResult {
  const [acciones, setAcciones] = useState<AdminAccion[]>([]);
  const [metrics, setMetrics] = useState<AdminBusinessMetrics | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [accionesRes, metricsRes] = await Promise.all([
      fetchAdminAcciones(AUDIT_PAGE_SIZE, (page - 1) * AUDIT_PAGE_SIZE),
      fetchAdminBusinessMetrics(),
    ]);

    if (accionesRes.error || metricsRes.error) {
      setError(
        accionesRes.error ??
          metricsRes.error ??
          'No fue posible cargar la auditoría de intendencia.',
      );
      setLoading(false);
      return;
    }

    setAcciones(accionesRes.data?.acciones ?? []);
    setTotalCount(accionesRes.data?.totalCount ?? 0);
    setMetrics(metricsRes.data ?? null);
    setLoading(false);
  }, [page]);

  useEffect(() => {
    // Mismo criterio que `use-admin-plans.ts`: el estado se actualiza dentro de
    // `reload`, que ya está memoizado por página.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const totalPages = Math.max(1, Math.ceil(totalCount / AUDIT_PAGE_SIZE));

  const goToPreviousPage = useCallback(() => {
    setPage((actual) => Math.max(1, actual - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPage((actual) => Math.min(totalPages, actual + 1));
  }, [totalPages]);

  return {
    acciones,
    metrics,
    totalCount,
    page,
    totalPages,
    loading,
    error,
    reload,
    goToPreviousPage,
    goToNextPage,
  };
}
