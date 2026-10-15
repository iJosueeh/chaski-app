import { beforeEach, describe, expect, it, vi } from 'vitest';

import { guardarExpedicion } from '../services/expediciones-plan.service';
import type { GuardarExpedicionInput } from '../interfaces/expediciones-plan.interface';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const baseInput: GuardarExpedicionInput = {
  solicitudId: 'solicitud-uuid-1',
  usuarioId: 'user-uuid-1234',
  estadoExpedicion: 'COMPLETADA',
  completadoEn: '2026-10-15T18:30:00.000Z',
  planSnapshot: {
    id: 'plan-uuid-1',
    titulo: 'Ruta de los soles',
    descripcion: 'Ruta equilibrada',
    variante: 'equilibrado',
    paradas: [],
    duracion_total_min: 180,
    costo_total: 45,
    distancia_km_aprox: 3.2,
  },
  paradasVisitadas: [1, 2, 3],
  paradasVisitadasIds: ['lugar-uuid-1', 'lugar-uuid-2', 'lugar-uuid-3'],
};

const persistedRow = {
  solicitud_id: baseInput.solicitudId,
  usuario_id: baseInput.usuarioId,
  estado_expedicion: 'COMPLETADA',
  completado_en: baseInput.completadoEn,
  plan_snapshot: baseInput.planSnapshot,
  paradas_visitadas: [1, 2, 3],
  paradas_visitadas_ids: ['lugar-uuid-1', 'lugar-uuid-2', 'lugar-uuid-3'],
};

function makeClient(result: { data?: unknown; error?: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const upsert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ upsert });
  return {
    client: { from } as unknown as typeof import('@/lib/supabase').supabase,
    from,
    upsert,
    select,
    single,
  };
}

describe('ExpedicionesPlanService - guardarExpedicion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hace upsert por solicitud_id con los datos completos de la expedición', async () => {
    const { client, from, upsert, select, single } = makeClient({
      data: persistedRow,
      error: null,
    });

    const res = await guardarExpedicion(baseInput, client);

    expect(res.error).toBeNull();
    expect(res.data?.solicitud_id).toBe('solicitud-uuid-1');
    expect(from).toHaveBeenCalledWith('expediciones_plan');
    expect(upsert).toHaveBeenCalledWith(
      {
        solicitud_id: 'solicitud-uuid-1',
        usuario_id: 'user-uuid-1234',
        estado_expedicion: 'COMPLETADA',
        completado_en: '2026-10-15T18:30:00.000Z',
        plan_snapshot: baseInput.planSnapshot,
        paradas_visitadas: [1, 2, 3],
        paradas_visitadas_ids: ['lugar-uuid-1', 'lugar-uuid-2', 'lugar-uuid-3'],
      },
      { onConflict: 'solicitud_id' },
    );
    expect(select).toHaveBeenCalled();
    expect(single).toHaveBeenCalled();
  });

  it('rechaza sin sesión (AUTH_REQUIRED) sin consultar', async () => {
    const { client, from } = makeClient({ data: null, error: null });

    const res = await guardarExpedicion({ ...baseInput, usuarioId: '   ' }, client);

    expect(res.data).toBeNull();
    expect(res.error?.type).toBe('AUTH_REQUIRED');
    expect(from).not.toHaveBeenCalled();
  });

  it('rechaza sin solicitud asociada (VALIDATION_ERROR) sin consultar', async () => {
    const { client, from } = makeClient({ data: null, error: null });

    const res = await guardarExpedicion({ ...baseInput, solicitudId: '' }, client);

    expect(res.data).toBeNull();
    expect(res.error?.type).toBe('VALIDATION_ERROR');
    expect(from).not.toHaveBeenCalled();
  });

  it('clasifica un error RLS como PERMISSION_DENIED', async () => {
    const { client } = makeClient({
      data: null,
      error: {
        code: '42501',
        message: 'new row violates row-level security policy for table "expediciones_plan"',
      },
    });

    const res = await guardarExpedicion(baseInput, client);

    expect(res.data).toBeNull();
    expect(res.error?.type).toBe('PERMISSION_DENIED');
  });

  it('clasifica una excepción de red como NETWORK_ERROR', async () => {
    const client = {
      from: vi.fn(() => {
        throw new TypeError('Failed to fetch');
      }),
    } as unknown as typeof import('@/lib/supabase').supabase;

    const res = await guardarExpedicion(baseInput, client);

    expect(res.data).toBeNull();
    expect(res.error?.type).toBe('NETWORK_ERROR');
  });
});
