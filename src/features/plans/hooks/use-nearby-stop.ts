/**
 * Sigue la ubicacion del usuario mientras el recorrido esta abierto y avisa
 * cuando se acerca a la siguiente parada.
 *
 * El permiso se pide al abrir la pantalla del recorrido, no al iniciar la app:
 * la aplicacion tiene que seguir siendo usable si el usuario lo niega.
 */

import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';

import type { PlanStop } from '@/features/plan-engine/plan-engine';

import { findNearbyStop, type Coordinates } from '../utils/nearby-stop';

/** Cada cuantos metros se vuelve a calcular la distancia a la parada. */
const DISTANCE_INTERVAL_METERS = 25;

export interface UseNearbyStopOptions {
  paradas: PlanStop[];
  visitadas: number[];
  habilitado?: boolean;
}

export interface UseNearbyStopResult {
  /** Parada dentro del radio de cercania, o null. */
  parada: PlanStop | null;
  /** Metros hasta la parada pendiente mas cercana, o null si no quedan. */
  metros: number | null;
  ubicacion: Coordinates | null;
  /** null mientras se resuelve el permiso. */
  permisoConcedido: boolean | null;
}

export function useNearbyStop({
  paradas,
  visitadas,
  habilitado = true,
}: UseNearbyStopOptions): UseNearbyStopResult {
  const [ubicacion, setUbicacion] = useState<Coordinates | null>(null);
  const [permisoConcedido, setPermisoConcedido] = useState<boolean | null>(null);

  useEffect(() => {
    if (!habilitado) {
      return;
    }

    let suscripcion: Location.LocationSubscription | null = null;
    let cancelado = false;

    async function seguirUbicacion() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelado) {
          return;
        }

        setPermisoConcedido(status === 'granted');
        if (status !== 'granted') {
          return;
        }

        suscripcion = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: DISTANCE_INTERVAL_METERS,
          },
          (posicion) => {
            setUbicacion({
              lat: posicion.coords.latitude,
              lng: posicion.coords.longitude,
            });
          },
        );
      } catch {
        if (!cancelado) {
          setPermisoConcedido(false);
        }
      }
    }

    void seguirUbicacion();

    return () => {
      cancelado = true;
      suscripcion?.remove();
    };
  }, [habilitado]);

  const cercana = useMemo(
    () =>
      ubicacion
        ? findNearbyStop(ubicacion, paradas, visitadas)
        : { parada: null, metros: null },
    [ubicacion, paradas, visitadas],
  );

  return { ...cercana, ubicacion, permisoConcedido };
}
