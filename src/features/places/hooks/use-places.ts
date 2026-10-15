/**
 * Hook `usePlaces` — catálogo de destinos activos (Serie AX).
 *
 * Encapsula la consulta `getActivePlaces` con su ciclo de vida de pantalla:
 * carga inicial, reintento (`reload`), refresco por gesto (`refresh`) y
 * protección frente a respuestas obsoletas. El resultado clasifica el fallo
 * en un «kind»; el copy de error, el espiner y los estados vacíos permanecen
 * en cada pantalla (presentación).
 *
 * Consumidores:
 * - Home (`(tabs)/index.tsx`): usa los 3 primeros como destacados, sin refresco.
 * - Catálogo `/places`: lista completa con refresco por gesto y reintento.
 * Ambos comparten consulta y ciclo de vida; sus diferencias son de
 * presentación, por lo que no se especializa un hook distinto.
 */
import { useCallback, useEffect, useReducer, useState } from 'react';

import { createLatestRequestGuard, type LatestRequestGuard } from '@/shared/utils/latest-request';

import type { Place } from '../interface/places.interface';
import { getActivePlaces } from '../services/places.service';

/** Clasificación del fallo de carga; el copy lo decide cada pantalla. */
export type PlacesErrorKind = 'service' | 'network';

/** Resultado clasificado de una consulta al catálogo, sin estado React. */
export type PlacesOutcome = {
  places: Place[] | null;
  errorKind: PlacesErrorKind | null;
};

/**
 * Consulta el catálogo activo y clasifica el fallo:
 * - 'service' cuando el servicio responde con error;
 * - 'network' cuando la petición falla (sin conexión, timeout).
 */
export async function loadActivePlacesOutcome(): Promise<PlacesOutcome> {
  try {
    const { data, error } = await getActivePlaces();

    if (error) {
      return { places: null, errorKind: 'service' };
    }

    return { places: data ?? [], errorKind: null };
  } catch {
    return { places: null, errorKind: 'network' };
  }
}

export type PlacesState = {
  places: Place[];
  loading: boolean;
  refreshing: boolean;
  errorKind: PlacesErrorKind | null;
};

export type PlacesAction =
  | { type: 'loadStarted'; mode: 'reload' | 'refresh' }
  | { type: 'loadSucceeded'; places: Place[] }
  | { type: 'loadFailed'; errorKind: PlacesErrorKind };

export const INITIAL_PLACES_STATE: PlacesState = {
  places: [],
  loading: true,
  refreshing: false,
  errorKind: null,
};

/**
 * Máquina de estados del catálogo:
 * - 'reload' (reintento): muestra carga y limpia el error, conserva la lista.
 * - 'refresh' (gesto): solo activa el indicador; la lista sigue visible.
 * - fallo: limpia la lista y expone el kind del error.
 */
export function placesReducer(state: PlacesState, action: PlacesAction): PlacesState {
  switch (action.type) {
    case 'loadStarted':
      return action.mode === 'refresh'
        ? { ...state, refreshing: true }
        : { ...state, loading: true, errorKind: null };
    case 'loadSucceeded':
      return { places: action.places, loading: false, refreshing: false, errorKind: null };
    case 'loadFailed':
      return { places: [], loading: false, refreshing: false, errorKind: action.errorKind };
    default:
      return state;
  }
}

/** Carga el catálogo de destinos activos con carga/error/refresco encapsulados. */
export function usePlaces(): PlacesState & {
  /** Recarga completa (reintento): muestra carga y limpia el error. */
  reload: () => void;
  /** Refresco por gesto: mantiene la lista visible mientras carga. */
  refresh: () => void;
} {
  const [state, dispatch] = useReducer(placesReducer, INITIAL_PLACES_STATE);

  // Identidad estable del guard por instancia de hook (se crea una sola vez).
  const [guard] = useState<LatestRequestGuard>(createLatestRequestGuard);

  const runLoad = useCallback(async () => {
    const requestId = guard.next();
    const outcome = await loadActivePlacesOutcome();

    // Descarta respuestas obsoletas (reintento/refresco rápidos o desmontaje).
    if (!guard.isCurrent(requestId)) return;

    if (outcome.errorKind) {
      dispatch({ type: 'loadFailed', errorKind: outcome.errorKind });
    } else {
      dispatch({ type: 'loadSucceeded', places: outcome.places ?? [] });
    }
  }, [guard]);

  useEffect(() => {
    runLoad();
    return () => guard.invalidate();
  }, [guard, runLoad]);

  const reload = useCallback(() => {
    dispatch({ type: 'loadStarted', mode: 'reload' });
    runLoad();
  }, [runLoad]);

  const refresh = useCallback(() => {
    dispatch({ type: 'loadStarted', mode: 'refresh' });
    runLoad();
  }, [runLoad]);

  return { ...state, reload, refresh };
}
