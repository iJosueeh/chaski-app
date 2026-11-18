/**
 * Hook del módulo de planes del panel de intendencia (Fase 1 · APF3).
 *
 * Carga en paralelo las solicitudes de plan y las expediciones de todos los
 * usuarios, y expone las eliminaciones con su estado de carga independiente.
 */

import { useCallback, useEffect, useState } from 'react';

import type {
  AdminExpedicion,
  AdminMutationResult,
  AdminPlansFilter,
  AdminSolicitud,
} from '../interfaces/admin.interface';
import {
  deleteAdminExpedicion,
  deleteAdminSolicitud,
  fetchAdminExpediciones,
  fetchAdminSolicitudes,
} from '../services/admin.service';

export interface UseAdminPlansResult {
  solicitudes: AdminSolicitud[];
  expediciones: AdminExpedicion[];
  totalSolicitudes: number;
  totalExpediciones: number;
  loading: boolean;
  error: string | null;
  deletingId: string | null;
  reload: () => Promise<void>;
  deleteSolicitud: (id: string) => Promise<AdminMutationResult>;
  deleteExpedicion: (solicitudId: string) => Promise<AdminMutationResult>;
}

export function useAdminPlans(
  filter: AdminPlansFilter = {},
): UseAdminPlansResult {
  const [solicitudes, setSolicitudes] = useState<AdminSolicitud[]>([]);
  const [expediciones, setExpediciones] = useState<AdminExpedicion[]>([]);
  const [totalSolicitudes, setTotalSolicitudes] = useState<number>(0);
  const [totalExpediciones, setTotalExpediciones] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const search = filter.search ?? '';
  const limit = filter.limit ?? 50;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [solicitudesRes, expedicionesRes] = await Promise.all([
      fetchAdminSolicitudes({ search, limit, offset: 0 }),
      fetchAdminExpediciones({ search, limit, offset: 0 }),
    ]);

    if (solicitudesRes.error || expedicionesRes.error) {
      setError(
        solicitudesRes.error ??
          expedicionesRes.error ??
          'No fue posible cargar los planes.',
      );
      setLoading(false);
      return;
    }

    setSolicitudes(solicitudesRes.data?.solicitudes ?? []);
    setTotalSolicitudes(solicitudesRes.data?.totalCount ?? 0);
    setExpediciones(expedicionesRes.data?.expediciones ?? []);
    setTotalExpediciones(expedicionesRes.data?.totalCount ?? 0);
    setLoading(false);
  }, [search, limit]);

  useEffect(() => {
    // Carga inicial y recarga al cambiar la búsqueda. El setState ocurre dentro
    // de `reload`, que ya está memoizado; se silencia la regla con el mismo
    // criterio que `use-admin-users.ts` (patrón aceptado en este proyecto).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const deleteSolicitud = useCallback(
    async (id: string): Promise<AdminMutationResult> => {
      setDeletingId(id);
      const result = await deleteAdminSolicitud(id);
      setDeletingId(null);

      if (result.success) {
        await reload();
      } else {
        setError(result.error ?? 'No fue posible eliminar la solicitud.');
      }

      return result;
    },
    [reload],
  );

  const deleteExpedicion = useCallback(
    async (solicitudId: string): Promise<AdminMutationResult> => {
      setDeletingId(solicitudId);
      const result = await deleteAdminExpedicion(solicitudId);
      setDeletingId(null);

      if (result.success) {
        await reload();
      } else {
        setError(result.error ?? 'No fue posible eliminar la expedición.');
      }

      return result;
    },
    [reload],
  );

  return {
    solicitudes,
    expediciones,
    totalSolicitudes,
    totalExpediciones,
    loading,
    error,
    deletingId,
    reload,
    deleteSolicitud,
    deleteExpedicion,
  };
}
