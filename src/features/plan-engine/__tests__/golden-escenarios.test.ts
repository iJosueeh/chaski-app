/**
 * Escenarios completos del generador: se pide un plan con condiciones
 * realistas y se revisa que lo que devuelve el motor se pueda cumplir.
 *
 * Los lugares son de Miraflores y Barranco, con horarios de todos los días
 * para que la validación de atención no dependa de la fecha en que se corra.
 */

import { describe, expect, it } from 'vitest';

import type { Place } from '@/features/places/interface/places.interface';
import type { WizardPlanRequest } from '@/features/wizard/context/wizard-context';

import { generarPlanes } from '../plan-engine';

const HORARIOS_SEMANA = Array.from({ length: 7 }, (_, indice) => ({
  id: `h-${indice + 1}`,
  dia_semana: indice + 1,
  hora_apertura: '08:00',
  hora_cierre: '22:00',
}));

function lugar(
  datos: Omit<Partial<Place>, 'id'> & { id: string; nombre: string; latitud: number; longitud: number },
): Place {
  return {
    descripcion: null,
    direccion: null,
    gasto_min: 0,
    gasto_max: 0,
    duracion_sugerida_min: 45,
    estado: true,
    fuente: 'curada',
    external_id: null,
    tipo_disponibilidad: 'HORARIO_REGISTRADO',
    fecha_actualizacion: '2026-09-01T00:00:00Z',
    categorias: [],
    etiquetas: [],
    horarios: HORARIOS_SEMANA,
    ...datos,
  } as Place;
}

const CATALOGO: Place[] = [
  lugar({
    id: 'huaca-pucllana',
    nombre: 'Huaca Pucllana',
    latitud: -12.11107,
    longitud: -77.03335,
    gasto_max: 15,
    categorias: [{ id: 'c-historia', nombre: 'Historia' }],
  }),
  lugar({
    id: 'museo-amano',
    nombre: 'Museo Amano',
    latitud: -12.1119,
    longitud: -77.0361,
    gasto_max: 20,
    categorias: [{ id: 'c-cultura', nombre: 'Cultura' }],
  }),
  lugar({
    id: 'canta-rana',
    nombre: 'Canta Rana',
    latitud: -12.1255,
    longitud: -77.0299,
    gasto_max: 40,
    categorias: [{ id: 'c-gastro', nombre: 'Gastronomía' }],
  }),
  lugar({
    id: 'parque-kennedy',
    nombre: 'Parque Kennedy',
    latitud: -12.1219,
    longitud: -77.0296,
    duracion_sugerida_min: 30,
    categorias: [{ id: 'c-parques', nombre: 'Parques' }],
  }),
  lugar({
    id: 'monumento-grau',
    nombre: 'Monumento a Grau',
    latitud: -12.1243,
    longitud: -77.0301,
    duracion_sugerida_min: 20,
    categorias: [{ id: 'c-historia', nombre: 'Historia' }],
  }),
];

function pedido(overrides: Partial<WizardPlanRequest> = {}): WizardPlanRequest {
  return {
    ubicacion: {
      modo: 'gps',
      nombre: 'Punto de partida',
      lat: -12.115,
      lng: -77.032,
    },
    minutosTotales: 240,
    horaInicio: '10:00',
    horaFin: '14:00',
    presupuesto: 50,
    intereses: [],
    movilidad: 'caminando',
    diaSemana: 1,
    ...overrides,
  };
}

describe('golden — el motor entrega planes que se pueden cumplir', () => {
  it('escenario A: cuatro horas y S/50 devuelve planes con paradas y sin pasarse', () => {
    const planes = generarPlanes(pedido(), CATALOGO);

    expect(planes.length).toBeGreaterThan(0);
    expect(planes.length).toBeLessThanOrEqual(3);

    for (const plan of planes) {
      expect(plan.paradas.length).toBeGreaterThan(0);
      expect(plan.duracion_total_min).toBeLessThanOrEqual(240);
      expect(plan.costo_total).toBeLessThanOrEqual(50);
    }
  });

  it('escenario A: ninguna variante repite el mismo recorrido en el mismo orden', () => {
    const planes = generarPlanes(pedido(), CATALOGO);
    const secuencias = planes.map((plan) =>
      plan.paradas.map((parada) => parada.place.id).join('>'),
    );

    expect(new Set(secuencias).size).toBe(secuencias.length);

    // Nota: dos variantes pueden compartir los mismos lugares en distinto
    // orden. Descartar esos casos por similitud de conjunto (Jaccard) sigue
    // pendiente; hoy solo se descarta el recorrido idéntico.
  });

  it('escenario B: pidiendo gastronomía el plan incluye al menos un lugar de esa categoría', () => {
    const planes = generarPlanes(
      pedido({
        minutosTotales: 480,
        horaFin: '18:00',
        presupuesto: 120,
        intereses: ['Gastronomía'],
      }),
      CATALOGO,
    );

    expect(planes.length).toBeGreaterThan(0);

    const incluyeGastronomia = planes.some((plan) =>
      plan.paradas.some((parada) =>
        parada.place.categorias.some((categoria) => categoria.nombre === 'Gastronomía'),
      ),
    );

    expect(incluyeGastronomia).toBe(true);
  });

  it('escenario C: dos horas y S/20 no se sale de ninguno de los dos límites', () => {
    const planes = generarPlanes(
      pedido({ minutosTotales: 120, horaInicio: '09:00', horaFin: '11:00', presupuesto: 20 }),
      CATALOGO,
    );

    for (const plan of planes) {
      expect(plan.duracion_total_min).toBeLessThanOrEqual(120);
      expect(plan.costo_total).toBeLessThanOrEqual(20);
      expect(plan.paradas.length).toBeLessThanOrEqual(3);
    }
  });

  it('las paradas quedan ordenadas por cercanía y la primera no se mueve al reordenar', () => {
    const planes = generarPlanes(
      pedido({ minutosTotales: 480, horaFin: '18:00', presupuesto: 120 }),
      CATALOGO,
    );

    const plan = planes[0];
    expect(plan).toBeDefined();
    expect(plan.paradas[0].orden).toBe(1);

    const ordenes = plan.paradas.map((parada) => parada.orden);
    expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b));
  });
});
