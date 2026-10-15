import { useState, useEffect, useCallback, useRef } from 'react';
import type { AdminMetrics } from '../interfaces/admin.interface';
import { fetchAdminMetrics } from '../services/admin.service';

export interface UseAdminMetricsOptions {
  autoFetch?: boolean;
}

export function useAdminMetrics(options: UseAdminMetricsOptions = {}) {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef<number>(0);
  const autoFetch = options.autoFetch !== false;

  const reloadMetrics = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    const result = await fetchAdminMetrics();

    if (currentRequestId !== requestIdRef.current) {
      return;
    }

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setMetrics(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (autoFetch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reloadMetrics();
    }
  }, [reloadMetrics, autoFetch]);

  return {
    metrics,
    loading,
    error,
    reloadMetrics,
  };
}
