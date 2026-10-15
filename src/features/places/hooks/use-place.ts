/**
 * Hook `usePlace(id)` — ficha de un destino (Serie AX).
 *
 * Encapsula la consulta `getPlaceById` con su ciclo de vida de pantalla:
 * carga inicial, cambio de id, reintento (`reload`) y protección frente a
 * respuestas obsoletas. El resultado clasifica el fallo en un «kind»; el copy
 * de error permanece en la pantalla (presentación).
 *
 * Consumidor: ficha `/place/[id]`. Es un hook específico porque su consulta
 * depende del id de la ruta y su semántica de carga («la ficha visible
 * corresponde al id pedido») no aplica al catálogo.
 */
import { useCallback, useEffect, useReducer, useState } from 'react';

import { createLatestRequestGuard, type LatestRequestGuard } from '@/shared/utils/latest-request';

import type { Place } from '../interface/places.interface';
import { getPlaceById } from '../services/places.service';

/** Clasificación del fallo; el copy lo decide la pantalla. */
export type PlaceErrorKind = 'missingId' | 'service' | 'notFound' | 'network';

/** Resultado clasificado de la consulta de una ficha, sin estado React. */
export type PlaceOutcome = {
  requestedId: string;
  place: Place | null;
  errorKind: PlaceErrorKind | null;
};

/**
 * Consulta la ficha y clasifica el fallo:
 * - 'missingId' sin consultar (id ausente);
 * - 'service' cuando el servicio responde con error;
 * - 'notFound' cuando no existe destino activo con ese id;
 * - 'network' cuando la petición falla (sin conexión, timeout).
 */
export async function loadPlaceOutcome(placeId: string): Promise<PlaceOutcome> {
  if (!placeId) {
    return { requestedId: placeId, place: null, errorKind: 'missingId' };
  }

  try {
    const { data, error } = await getPlaceById(placeId);

    if (error) {
      return { requestedId: placeId, place: null, errorKind: 'service' };
    }

    if (!data) {
      return { requestedId: placeId, place: null, errorKind: 'notFound' };
    }

    return { requestedId: placeId, place: data, errorKind: null };
  } catch {
    return { requestedId: placeId, place: null, errorKind: 'network' };
  }
}

export type PlaceState = {
  place: Place | null;
  /** Id cuya consulta ya resolvió (null = sin resolver o recarga en curso). */
  resolvedId: string | null;
  errorKind: PlaceErrorKind | null;
};

export type PlaceAction =
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; requestedId: string; place: Place }
  | { type: 'loadFailed'; requestedId: string; errorKind: Exclude<PlaceErrorKind, 'missingId'> };

export const INITIAL_PLACE_STATE: PlaceState = {
  place: null,
  resolvedId: null,
  errorKind: null,
};

/**
 * Máquina de estados de la ficha:
 * - 'loadStarted' (reintento): invalida el id resuelto para mostrar carga;
 *   conserva el error hasta que la nueva consulta resuelva.
 * - resolución: la ficha y el id resuelto siempre quedan asociados juntos.
 */
export function placeReducer(state: PlaceState, action: PlaceAction): PlaceState {
  switch (action.type) {
    case 'loadStarted':
      return { ...state, resolvedId: null };
    case 'loadSucceeded':
      return { place: action.place, resolvedId: action.requestedId, errorKind: null };
    case 'loadFailed':
      return { place: null, resolvedId: action.requestedId, errorKind: action.errorKind };
    default:
      return state;
  }
}

/**
 * true mientras la ficha visible no corresponda al id pedido: carga inicial,
 * cambio de id en la ruta y recarga tras un reintento.
 */
export function isPlaceLoading(id: string | undefined, resolvedId: string | null): boolean {
  return Boolean(id) && resolvedId !== id;
}

/** Carga la ficha de un destino con carga/error/reintento encapsulados. */
export function usePlace(id: string | undefined): {
  place: Place | null;
  loading: boolean;
  errorKind: PlaceErrorKind | null;
  /** Reconsulta la ficha (reintento): vuelve a mostrar carga. */
  reload: () => void;
} {
  const [state, dispatch] = useReducer(placeReducer, INITIAL_PLACE_STATE);

  // Identidad estable del guard por instancia de hook (se crea una sola vez).
  const [guard] = useState<LatestRequestGuard>(createLatestRequestGuard);

  const runLoad = useCallback(async () => {
    const requestId = guard.next();
    const outcome = await loadPlaceOutcome(id ?? '');

    // Descarta respuestas obsoletas (cambio de id, reintento o desmontaje).
    if (!guard.isCurrent(requestId)) return;

    if (outcome.errorKind && outcome.errorKind !== 'missingId') {
      dispatch({
        type: 'loadFailed',
        requestedId: outcome.requestedId,
        errorKind: outcome.errorKind,
      });
    } else if (outcome.place) {
      dispatch({ type: 'loadSucceeded', requestedId: outcome.requestedId, place: outcome.place });
    }
  }, [guard, id]);

  useEffect(() => {
    if (!id) return;

    runLoad();
    return () => guard.invalidate();
  }, [guard, id, runLoad]);

  const reload = useCallback(() => {
    dispatch({ type: 'loadStarted' });
    runLoad();
  }, [runLoad]);

  return {
    place: state.place,
    loading: isPlaceLoading(id, state.resolvedId),
    // Sin id no hay consulta posible: la pantalla muestra el error de inmediato.
    errorKind: !id ? 'missingId' : state.errorKind,
    reload,
  };
}
