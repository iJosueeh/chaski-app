import { describe, expect, it, vi } from 'vitest';

import { listarSolicitudesHistorial } from '../services/solicitudes-plan.service';
import type { SolicitudHistorialEntry } from '../interfaces/solicitudes-plan.interface';
import {
  formatHistoryDate,
  formatHistoryStatusLabel,
  formatTotalDuration,
} from '../utils/historial-formatters';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const planSnapshot = {
  id: 'intimo-1792074225515',
  score: 61.24,
  titulo: 'Ruta Íntima',
  variante: 'intimo',
  costo_total: 0,
  distancia_km_aprox: 11.5,
  duracion_total_min: 72,
  descripcion: '1 parada desde Monumento a José de San Martín',
  solicitud_id: '30a6ac3d-cfe9-4b7c-8537-1ba56e6bc200',
  paradas: [
    {
      orden: 1,
      llegada: '10:27',
      duracion_min: 15,
      costo_estimado: 0,
      traslado_desde_anterior_min: 57,
      place: {
        id: '734d78cd-c989-4ab8-8627-4b2c13ceede7',
        nombre: 'Monumento a José de San Martín',
        latitud: -12.14328,
        longitud: -77.02315,
        direccion: null,
        categorias: [],
        etiquetas: [],
        horarios: [],
        imagenes: [],
      },
    },
  ],
};

const makeSolicitudRow = (expediciones_plan: unknown) => ({
  id: '30a6ac3d-cfe9-4b7c-8537-1ba56e6bc200',
  usuario_id: 'c7cc0f56-e145-4abd-b2ce-dd3d67802e15',
  fecha_hora_inicio: '2026-10-15T10:00:00+00:00',
  fecha_hora_fin: '2026-10-15T14:00:00+00:00',
  inicio_latitud: -12.14328,
  inicio_longitud: -77.02315,
  inicio_descripcion: 'Plaza Mayor de Lima',
  tipo_punto_final: 'REGRESAR_INICIO',
  final_latitud: null,
  final_longitud: null,
  final_descripcion: null,
  gasto_min: 0,
  gasto_max: 60,
  movilidad: 'CAMINANDO',
  fecha_creacion: '2026-10-15T09:59:00+00:00',
  solicitudes_plan_categorias: [{ categorias: { nombre: 'Cultura' } }],
  expediciones_plan,
});

function makeClient(result: { data?: unknown; error?: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return {
    client: { from } as unknown as typeof import('@/lib/supabase').supabase,
    from,
    select,
    eq,
    order,
  };
}

function transitThroughRouter(entry: SolicitudHistorialEntry): SolicitudHistorialEntry {
  return JSON.parse(JSON.stringify(entry)) as SolicitudHistorialEntry;
}

describe('Historial de expedición: pipeline completo (fetch → tarjeta → detalle)', () => {
  it('la fila real recupera fecha de cierre y paradas tras el ida y vuelta de params del router', async () => {
    const { client } = makeClient({
      data: [
        makeSolicitudRow({
          estado_expedicion: 'COMPLETADA',
          completado_en: '2026-10-15T14:23:58.063+00:00',
          plan_snapshot: planSnapshot,
          paradas_visitadas: [1],
          paradas_visitadas_ids: ['734d78cd-c989-4ab8-8627-4b2c13ceede7'],
        }),
      ],
      error: null,
    });

    const res = await listarSolicitudesHistorial('c7cc0f56-e145-4abd-b2ce-dd3d67802e15', client);
    expect(res.error).toBeNull();

    const entry = transitThroughRouter(res.data[0]);
    const expedicion = entry.expedicion;

    expect(expedicion).not.toBeNull();
    expect(expedicion!.estado_expedicion).toBe('COMPLETADA');

    const fechaCierre = expedicion!.completado_en;
    expect(fechaCierre).toBeTruthy();
    expect(Number.isNaN(new Date(fechaCierre!).getTime())).toBe(false);
    expect(formatHistoryDate(fechaCierre!)).not.toBe('Fecha no disponible');
    expect(formatHistoryDate(fechaCierre!)).toContain('2026');

    const snapshot = expedicion!.plan_snapshot;
    expect(snapshot).not.toBeNull();
    expect(snapshot!.paradas).toHaveLength(1);
    expect(snapshot!.paradas[0].place?.nombre).toBe('Monumento a José de San Martín');
    expect(snapshot!.paradas[0].llegada).toBe('10:27');
    expect(expedicion!.paradas_visitadas).toEqual([1]);
    expect(formatTotalDuration(snapshot!.duracion_total_min)).toBe('1h 12m');
    expect(formatHistoryStatusLabel(expedicion!.estado_expedicion, 1, 1)).toBe(
      '1 parada alcanzada (100%)',
    );
  });

  it('normaliza un plan_snapshot almacenado como string JSON', async () => {
    const { client } = makeClient({
      data: [
        makeSolicitudRow({
          estado_expedicion: 'PARCIAL',
          completado_en: '2026-10-15T18:00:00.000+00:00',
          plan_snapshot: JSON.stringify(planSnapshot),
          paradas_visitadas: [],
          paradas_visitadas_ids: [],
        }),
      ],
      error: null,
    });

    const res = await listarSolicitudesHistorial('c7cc0f56-e145-4abd-b2ce-dd3d67802e15', client);

    expect(res.data[0].expedicion?.plan_snapshot?.paradas).toHaveLength(1);
  });

  it('devuelve expedicion null cuando el embed llega sin datos utilizables', async () => {
    const { client } = makeClient({
      data: [makeSolicitudRow({})],
      error: null,
    });

    const res = await listarSolicitudesHistorial('c7cc0f56-e145-4abd-b2ce-dd3d67802e15', client);

    expect(res.data[0].expedicion).toBeNull();
  });

  it('tolera un embed en forma de arreglo y conserva sus campos', async () => {
    const { client } = makeClient({
      data: [
        makeSolicitudRow([
          {
            estado_expedicion: 'COMPLETADA',
            completado_en: '2026-10-15T14:23:58.063+00:00',
            plan_snapshot: planSnapshot,
            paradas_visitadas: [1],
            paradas_visitadas_ids: ['734d78cd-c989-4ab8-8627-4b2c13ceede7'],
          },
        ]),
      ],
      error: null,
    });

    const res = await listarSolicitudesHistorial('c7cc0f56-e145-4abd-b2ce-dd3d67802e15', client);

    expect(res.data[0].expedicion?.estado_expedicion).toBe('COMPLETADA');
    expect(res.data[0].expedicion?.plan_snapshot?.paradas).toHaveLength(1);
  });
});
