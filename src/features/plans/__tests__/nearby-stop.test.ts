import { describe, expect, it } from 'vitest';

import type { Place } from '@/features/places/interface/places.interface';
import type { PlanStop } from '@/features/plan-engine/plan-engine';

import { findNearbyStop } from '../utils/nearby-stop';

const HUACA = { lat: -12.11107, lng: -77.03335 };
const AMANO = { lat: -12.1119, lng: -77.0361 };

function mkPlace(id: string, coords: { lat: number; lng: number }): Place {
  return {
    id,
    nombre: `Lugar ${id}`,
    descripcion: null,
    direccion: null,
    latitud: coords.lat,
    longitud: coords.lng,
    gasto_min: 0,
    gasto_max: 0,
    duracion_sugerida_min: 45,
    estado: true,
    fuente: 'curada',
    external_id: null,
    tipo_disponibilidad: 'LIBRE_ACCESO',
    fecha_actualizacion: '2026-09-01T00:00:00Z',
    categorias: [],
    etiquetas: [],
    horarios: [],
  };
}

function mkStop(orden: number, coords: { lat: number; lng: number }): PlanStop {
  return {
    place: mkPlace(`lugar-${orden}`, coords),
    orden,
    llegada: '10:00',
    duracion_min: 45,
    traslado_desde_anterior_min: 5,
    costo_estimado: 0,
  };
}

describe('nearby-stop — findNearbyStop', () => {
  it('encuentra la parada cuando el usuario esta encima', () => {
    const paradas = [mkStop(1, HUACA), mkStop(2, AMANO)];
    const resultado = findNearbyStop(HUACA, paradas, []);

    expect(resultado.parada?.orden).toBe(1);
    expect(resultado.metros).toBe(0);
  });

  it('avisa cuando esta a menos de 120 metros', () => {
    const paradas = [mkStop(1, HUACA)];
    // Unos 30 metros al norte de la huaca.
    const resultado = findNearbyStop({ lat: HUACA.lat + 0.00027, lng: HUACA.lng }, paradas, []);

    expect(resultado.parada?.orden).toBe(1);
    expect(resultado.metros).toBeGreaterThan(20);
    expect(resultado.metros).toBeLessThan(45);
  });

  it('no avisa nada cuando la parada esta lejos, pero informa la distancia', () => {
    const paradas = [mkStop(1, HUACA)];
    const resultado = findNearbyStop(AMANO, paradas, []);

    expect(resultado.parada).toBeNull();
    expect(resultado.metros).toBeGreaterThan(200);
  });

  it('ignora las paradas ya visitadas', () => {
    const paradas = [mkStop(1, HUACA), mkStop(2, AMANO)];
    const resultado = findNearbyStop(HUACA, paradas, [1]);

    expect(resultado.parada).toBeNull();
    expect(resultado.metros).toBeGreaterThan(200);
  });

  it('devuelve null cuando ya no quedan paradas pendientes', () => {
    const paradas = [mkStop(1, HUACA)];
    const resultado = findNearbyStop(HUACA, paradas, [1]);

    expect(resultado.parada).toBeNull();
    expect(resultado.metros).toBeNull();
  });

  it('respeta un radio propio', () => {
    const paradas = [mkStop(1, HUACA)];
    const lejos = { lat: HUACA.lat + 0.00027, lng: HUACA.lng };

    expect(findNearbyStop(lejos, paradas, [], 10).parada).toBeNull();
    expect(findNearbyStop(lejos, paradas, [], 500).parada?.orden).toBe(1);
  });
});
