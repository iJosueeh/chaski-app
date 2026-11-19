/**
 * Hook para el módulo de Reportes y Estadísticas Administrativas (RF20 / CU09).
 * Gestiona el ciclo de vida, selección de período temporal y datos agregados.
 */

import { useCallback, useEffect, useState } from 'react';

import type {
  AdminReportPeriodo,
  AdminReportsResult,
} from '../interfaces/admin.interface';
import { fetchAdminReports } from '../services/admin.service';

export interface UseAdminReportsResult {
  reports: AdminReportsResult | null;
  loading: boolean;
  error: string | null;
  periodo: AdminReportPeriodo;
  desde: string | null;
  hasta: string | null;
  setPeriodo: (periodo: AdminReportPeriodo) => void;
  setRangoPersonalizado: (desde: string, hasta: string) => void;
  reload: () => Promise<void>;
}

export function useAdminReports(
  initialPeriodo: AdminReportPeriodo = '30d',
): UseAdminReportsResult {
  const [periodo, setPeriodoState] = useState<AdminReportPeriodo>(initialPeriodo);
  const [desde, setDesde] = useState<string | null>(null);
  const [hasta, setHasta] = useState<string | null>(null);
  const [reports, setReports] = useState<AdminReportsResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReportsData = useCallback(
    async (p: AdminReportPeriodo, d: string | null, h: string | null) => {
      setLoading(true);
      setError(null);

      const res = await fetchAdminReports({
        periodo: p,
        desde: p === 'personalizado' ? (d ?? undefined) : undefined,
        hasta: p === 'personalizado' ? (h ?? undefined) : undefined,
      });

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setReports(res.data);
      setLoading(false);
    },
    [],
  );

  const reload = useCallback(async () => {
    await fetchReportsData(periodo, desde, hasta);
  }, [fetchReportsData, periodo, desde, hasta]);

  const setPeriodo = useCallback(
    (nuevoPeriodo: AdminReportPeriodo) => {
      setPeriodoState(nuevoPeriodo);
      if (nuevoPeriodo !== 'personalizado') {
        setDesde(null);
        setHasta(null);
      }
    },
    [],
  );

  const setRangoPersonalizado = useCallback(
    (nuevoDesde: string, nuevoHasta: string) => {
      setPeriodoState('personalizado');
      setDesde(nuevoDesde);
      setHasta(nuevoHasta);
    },
    [],
  );

  useEffect(() => {
    if (periodo === 'personalizado' && (!desde || !hasta)) {
      return;
    }
    // Mismo criterio que use-admin-auditoria.ts: estado se actualiza en fetchReportsData
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchReportsData(periodo, desde, hasta);
  }, [periodo, desde, hasta, fetchReportsData]);

  return {
    reports,
    loading,
    error,
    periodo,
    desde,
    hasta,
    setPeriodo,
    setRangoPersonalizado,
    reload,
  };
}
