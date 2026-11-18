/**
 * Busqueda de la parada mas cercana al usuario.
 *
 * Es una funcion pura: recibe coordenadas y devuelve la parada pendiente mas
 * cercana. El componente que la usa se encarga de leer el GPS.
 */

import type { PlanStop } from '@/features/plan-engine/plan-engine';
import { calculateHaversineDistanceKm } from '@/features/plan-engine/viability';

import { NEARBY_STOP_RADIUS_METERS } from './plan-reminders';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface NearbyStopMatch {
  /** Parada dentro del radio, o null si ninguna esta lo bastante cerca. */
  parada: PlanStop | null;
  /** Metros hasta la parada pendiente mas cercana, o null si ya no queda ninguna. */
  metros: number | null;
}

/**
 * Devuelve la parada pendiente mas cercana a `coords`.
 *
 * Solo cuenta como cercana si esta dentro de `radioMetros`; las paradas ya
 * marcadas como visitadas se ignoran.
 */
export function findNearbyStop(
  coords: Coordinates,
  paradas: PlanStop[],
  visitadas: number[],
  radioMetros: number = NEARBY_STOP_RADIUS_METERS,
): NearbyStopMatch {
  const pendientes = paradas.filter((parada) => !visitadas.includes(parada.orden));
  if (pendientes.length === 0) {
    return { parada: null, metros: null };
  }

  let masCercana: PlanStop | null = null;
  let menorDistanciaMetros = Number.POSITIVE_INFINITY;

  for (const parada of pendientes) {
    const km = calculateHaversineDistanceKm(
      coords.lat,
      coords.lng,
      parada.place.latitud,
      parada.place.longitud,
    );
    const metros = km * 1000;

    if (metros < menorDistanciaMetros) {
      menorDistanciaMetros = metros;
      masCercana = parada;
    }
  }

  if (!masCercana) {
    return { parada: null, metros: null };
  }

  const metrosRedondeados = Math.round(menorDistanciaMetros);
  return {
    parada: menorDistanciaMetros <= radioMetros ? masCercana : null,
    metros: metrosRedondeados,
  };
}
