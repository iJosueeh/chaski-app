import { describe, expect, it } from 'vitest';

import type { Place } from '@/features/places/interface/places.interface';
import type { WizardPlanRequest } from '@/features/wizard/context/wizard-context';

import { generarPlanes, type PlanStop } from '../plan-engine';
import { optimizarOrdenParadas, type RouteOrderContext } from '../route-order';
import { calculateHaversineDistanceKm } from '../viability';

function mkPlace(
  id: string,
  coords: { lat: number; lng: number },
  overrides: Partial<Place> = {},
): Place {
  return {
    id,
    nombre: `Lugar ${id}`,
    descripcion: null,
    direccion: null,
    latitud: coords.lat,
    longitud: coords.lng,
    gasto_min: 0,
    gasto_max: 0,
    duracion_sugerida_min: 60,
    estado: true,
    fuente: 'curada',
    external_id: null,
    tipo_disponibilidad: 'LIBRE_ACCESO',
    fecha_actualizacion: '2026-09-01T00:00:00Z',
    categorias: [{ id: 'cat-cultura', nombre: 'Cultura' }],
    etiquetas: [],
    horarios: [],
    ...overrides,
  };
}

function mkStop(place: Place, duracion = 60): PlanStop {
  return {
    place,
    orden: 1,
    llegada: '10:00',
    duracion_min: duracion,
    traslado_desde_anterior_min: 5,
    costo_estimado: 0,
  };
}

/**
 * Distancia total de la secuencia, calculada aqui a proposito en lugar de
 * reutilizar la del modulo: la prueba debe medir con una implementacion
 * independiente para que un error en `evaluarOrden` no pase inadvertido.
 */
function secuenciaKm(paradas: PlanStop[], ctx: RouteOrderContext): number {
  let total = 0;
  let previo = ctx.origen;
  for (const parada of paradas) {
    total += calculateHaversineDistanceKm(
      previo.lat,
      previo.lng,
      parada.place.latitud,
      parada.place.longitud,
    );
    previo = { lat: parada.place.latitud, lng: parada.place.longitud };
  }
  return total;
}

/** Contexto base: domingo, arranca 10:00, movilidad aplicativo (20 km/h). */
function mkCtx(overrides: Partial<RouteOrderContext> = {}): RouteOrderContext {
  return {
    origen: { lat: -12.11107, lng: -77.03335 },
    movilidad: 'aplicativo',
    startMinutes: 10 * 60,
    diaSemanaInicial: 7,
    ...overrides,
  };
}

/* ── Coordenadas reales del caso reportado en la app ─────────────────────── */
const HUACA = { lat: -12.11107, lng: -77.03335 };
const CANTA_RANA = { lat: -12.14676, lng: -77.02232 };
const MONUMENTO = { lat: -12.14328, lng: -77.02315 };
const AMANO = { lat: -12.11406, lng: -77.04077 };

describe('route-order · optimizarOrdenParadas', () => {
  describe('regresión del zigzag real medido en producción', () => {
    it('reordena Miraflores → Barranco → Miraflores y ahorra >30% de kilómetros', () => {
      const huaca = mkPlace('huaca', HUACA);
      const cantaRana = mkPlace('canta-rana', CANTA_RANA);
      const monumento = mkPlace('monumento', MONUMENTO);
      const amano = mkPlace('amano', AMANO);

      // Orden que produjo el motor antes de la Fase 2.1 (8.31 km medidos).
      const paradas = [
        mkStop(huaca),
        mkStop(cantaRana),
        mkStop(monumento, 15),
        mkStop(amano),
      ];

      const ctx = mkCtx();
      const antes = secuenciaKm(paradas, ctx);
      const resultado = optimizarOrdenParadas(paradas, ctx);

      expect(resultado.reordenado).toBe(true);
      expect(resultado.distanciaKm).toBeLessThan(antes);
      // Ahorro esperado: ~39% (8.31 km → ~5.04 km)
      expect(resultado.ahorroKm / antes).toBeGreaterThan(0.3);

      // Orden geográfico óptimo: el museo cercano primero, Barranco al final.
      expect(resultado.paradas.map((p) => p.place.id)).toEqual([
        'huaca',
        'amano',
        'monumento',
        'canta-rana',
      ]);
    });

    it('nunca mueve la parada ancla (índice 0)', () => {
      const huaca = mkPlace('huaca', HUACA);
      const cantaRana = mkPlace('canta-rana', CANTA_RANA);
      const monumento = mkPlace('monumento', MONUMENTO);

      const paradas = [mkStop(huaca), mkStop(cantaRana), mkStop(monumento, 15)];
      const resultado = optimizarOrdenParadas(paradas, mkCtx());

      expect(resultado.paradas[0].place.id).toBe('huaca');
    });
  });

  describe('factibilidad horaria', () => {
    it('rechaza un orden más corto si deja una parada fuera de su horario', () => {
      const origen = { lat: -12.12, lng: -77.03 };
      // B a ~0.5 km del origen, X a ~5.4 km con ventana estrecha.
      const cercano = mkPlace('cercano', { lat: -12.12, lng: -77.025 });
      const lejanoRestringido = mkPlace('restringido', { lat: -12.12, lng: -76.98 }, {
        tipo_disponibilidad: 'HORARIO_REGISTRADO',
        duracion_sugerida_min: 15,
        horarios: [
          {
            id: 'h-x',
            dia_semana: 7,
            hora_apertura: '10:00',
            hora_cierre: '10:30',
          },
        ],
      });

      // Orden dado: restringido primero (llega 10:16 → cabe), cercano después.
      const paradas = [
        mkStop(lejanoRestringido, 15),
        mkStop(cercano, 60),
      ];

      const ctx = mkCtx({ origen });
      const resultado = optimizarOrdenParadas(paradas, ctx);

      // El orden alterno (cercano primero) sería más corto, pero al llegar al
      // restringido más tarde quedaría cerrado: debe conservarse el original.
      expect(resultado.reordenado).toBe(false);
      expect(resultado.paradas.map((p) => p.place.id)).toEqual([
        'restringido',
        'cercano',
      ]);
    });
  });

  describe('casos que no deben cambiar nada', () => {
    it('con 2 paradas devuelve el mismo arreglo sin marcar reorden', () => {
      const a = mkPlace('a', HUACA);
      const b = mkPlace('b', CANTA_RANA);
      const paradas = [mkStop(a), mkStop(b)];

      const resultado = optimizarOrdenParadas(paradas, mkCtx());

      expect(resultado.reordenado).toBe(false);
      expect(resultado.paradas).toBe(paradas);
    });

    it('si el orden ya es el óptimo no hace cambios (sin ruido)', () => {
      const huaca = mkPlace('huaca', HUACA);
      const amano = mkPlace('amano', AMANO);
      const monumento = mkPlace('monumento', MONUMENTO);
      const cantaRana = mkPlace('canta-rana', CANTA_RANA);

      const optimo = [
        mkStop(huaca),
        mkStop(amano),
        mkStop(monumento, 15),
        mkStop(cantaRana),
      ];

      const resultado = optimizarOrdenParadas(optimo, mkCtx());

      expect(resultado.reordenado).toBe(false);
      expect(resultado.paradas).toBe(optimo);
    });
  });

  describe('determinismo y totales', () => {
    it('dos corridas idénticas producen exactamente el mismo resultado', () => {
      const paradas = [
        mkStop(mkPlace('huaca', HUACA)),
        mkStop(mkPlace('canta-rana', CANTA_RANA)),
        mkStop(mkPlace('monumento', MONUMENTO), 15),
        mkStop(mkPlace('amano', AMANO)),
      ];

      const uno = optimizarOrdenParadas(paradas, mkCtx());
      const dos = optimizarOrdenParadas(paradas, mkCtx());

      expect(uno.paradas.map((p) => p.place.id)).toEqual(
        dos.paradas.map((p) => p.place.id),
      );
      expect(uno.paradas.map((p) => p.llegada)).toEqual(
        dos.paradas.map((p) => p.llegada),
      );
      expect(uno.distanciaKm).toBe(dos.distanciaKm);
    });

    it('recalcula llegadas crecientes, orden y traslados coherentes', () => {
      const paradas = [
        mkStop(mkPlace('huaca', HUACA), 60),
        mkStop(mkPlace('canta-rana', CANTA_RANA), 60),
        mkStop(mkPlace('monumento', MONUMENTO), 15),
        mkStop(mkPlace('amano', AMANO), 60),
      ];

      const resultado = optimizarOrdenParadas(paradas, mkCtx());

      // orden secuencial 1..n
      expect(resultado.paradas.map((p) => p.orden)).toEqual([1, 2, 3, 4]);

      // llegadas estrictamente crecientes (misma jornada)
      const minutos = resultado.paradas.map((p) => {
        const [h, m] = p.llegada.split(':').map(Number);
        return h * 60 + m;
      });
      for (let i = 1; i < minutos.length; i++) {
        expect(minutos[i]).toBeGreaterThan(minutos[i - 1]);
      }

      // distancia = origen→1ª + tramos intermedios
      let esperado = calculateHaversineDistanceKm(
        -12.11107,
        -77.03335,
        resultado.paradas[0].place.latitud,
        resultado.paradas[0].place.longitud,
      );
      for (let i = 1; i < resultado.paradas.length; i++) {
        esperado += calculateHaversineDistanceKm(
          resultado.paradas[i - 1].place.latitud,
          resultado.paradas[i - 1].place.longitud,
          resultado.paradas[i].place.latitud,
          resultado.paradas[i].place.longitud,
        );
      }
      expect(resultado.distanciaKm).toBeCloseTo(esperado, 6);

      // duración = Σ(traslado + permanencia)
      const duracionEsperada = resultado.paradas.reduce(
        (acc, p) => acc + p.traslado_desde_anterior_min + p.duracion_min,
        0,
      );
      expect(resultado.duracionTotalMin).toBe(duracionEsperada);
    });
  });
});

describe('route-order · integración con generarPlanes', () => {
  it('los planes entregados tienen distancia consistente con sus paradas finales', () => {
    const origen = { lat: HUACA.lat, lng: HUACA.lng };
    const request: WizardPlanRequest = {
      ubicacion: { modo: 'gps', nombre: 'Origen', lat: origen.lat, lng: origen.lng },
      minutosTotales: 540,
      horaInicio: '10:00',
      horaFin: '19:00',
      presupuesto: 200,
      intereses: [],
      movilidad: 'aplicativo',
      diaSemana: 7,
    };

    const places: Place[] = [
      mkPlace('huaca', HUACA),
      mkPlace('canta-rana', CANTA_RANA),
      mkPlace('monumento', MONUMENTO, {
        duracion_sugerida_min: 15,
      }),
      mkPlace('amano', AMANO),
    ];

    const planes = generarPlanes(request, places);
    expect(planes.length).toBeGreaterThan(0);

    for (const plan of planes) {
      // La distancia reportada debe coincidir con la del orden MOSTRADO.
      let esperado = calculateHaversineDistanceKm(
        origen.lat,
        origen.lng,
        plan.paradas[0].place.latitud,
        plan.paradas[0].place.longitud,
      );
      for (let i = 1; i < plan.paradas.length; i++) {
        esperado += calculateHaversineDistanceKm(
          plan.paradas[i - 1].place.latitud,
          plan.paradas[i - 1].place.longitud,
          plan.paradas[i].place.latitud,
          plan.paradas[i].place.longitud,
        );
      }
      expect(plan.distancia_km_aprox).toBeCloseTo(
        Math.round(esperado * 10) / 10,
        1,
      );

      // El ancla es la primera parada y el orden va 1..n.
      expect(plan.paradas[0].orden).toBe(1);
      expect(plan.descripcion).toContain(String(plan.paradas.length));
    }
  });
});
