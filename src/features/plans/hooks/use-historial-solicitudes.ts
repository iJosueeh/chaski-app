import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/features/auth/context/auth-context';

import type { SolicitudHistorialEntry } from '../interfaces/solicitudes-plan.interface';
import { listarSolicitudesHistorial } from '../services/solicitudes-plan.service';

export function useHistorialSolicitudes() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const activeUserIdRef = useRef<string | null>(userId);
  const [state, setState] = useState<{ userId: string | null; solicitudes: SolicitudHistorialEntry[] }>({
    userId: null,
    solicitudes: [],
  });

  useFocusEffect(
    useCallback(() => {
      activeUserIdRef.current = userId;
      if (!userId) return;

      listarSolicitudesHistorial(userId)
        .then((res) => {
          if (activeUserIdRef.current !== userId) return;
          setState({ userId, solicitudes: res.data });
        })
        .catch(() => {
          if (activeUserIdRef.current !== userId) return;
          setState({ userId, solicitudes: [] });
        });
    }, [userId]),
  );

  return {
    solicitudes: state.userId === userId ? state.solicitudes : [],
    loading: userId !== null && state.userId !== userId,
  };
}
