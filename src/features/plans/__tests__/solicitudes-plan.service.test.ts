import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSolicitudFechas,
  clearSolicitudPlanCache,
  guardarSolicitudPlan,
  guardarSolicitudPlanFromWizard,
  listarSolicitudesHistorial,
  mapWizardMovilidadToDb,
  resolveCategoryIds,
  validarInputSolicitud,
} from '../services/solicitudes-plan.service';
import type { GuardarSolicitudPlanInput } from '../interfaces/solicitudes-plan.interface';
import type { WizardPlanRequest } from '@/features/wizard/context/wizard-context';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('SolicitudesPlanService - Fase 2A', () => {
  beforeEach(() => {
    clearSolicitudPlanCache();
    vi.clearAllMocks();
  });

  describe('buildSolicitudFechas', () => {
    it('garantiza siempre que fechaHoraFin > fechaHoraInicio', () => {
      const base = new Date('2026-10-15T10:00:00.000Z');
      const { fechaHoraInicio, fechaHoraFin } = buildSolicitudFechas({
        fecha: '2026-10-15',
        horaInicio: '10:00',
        horaFin: '14:00',
        baseDate: base,
      });

      expect(new Date(fechaHoraFin).getTime()).toBeGreaterThan(new Date(fechaHoraInicio).getTime());
    });

    it('maneja cruce de medianoche sumando un día a la fecha fin', () => {
      const base = new Date('2026-10-15T22:00:00.000Z');
      const { fechaHoraInicio, fechaHoraFin } = buildSolicitudFechas({
        fecha: '2026-10-15',
        horaInicio: '22:00',
        horaFin: '02:00',
        baseDate: base,
      });

      expect(new Date(fechaHoraFin).getTime()).toBeGreaterThan(new Date(fechaHoraInicio).getTime());
    });

    it('calcula fechaHoraFin a partir de minutosTotales si no hay horaFin', () => {
      const base = new Date('2026-10-15T09:00:00.000Z');
      const { fechaHoraInicio, fechaHoraFin } = buildSolicitudFechas({
        fecha: '2026-10-15',
        horaInicio: '09:00',
        minutosTotales: 180, // 3 horas
        baseDate: base,
      });

      const diffMin = (new Date(fechaHoraFin).getTime() - new Date(fechaHoraInicio).getTime()) / 60000;
      expect(diffMin).toBe(180);
    });
  });

  describe('mapWizardMovilidadToDb', () => {
    it('mapea correctamente las opciones del wizard a los enums de base de datos', () => {
      expect(mapWizardMovilidadToDb('caminando')).toBe('CAMINANDO');
      expect(mapWizardMovilidadToDb('publico')).toBe('TRANSPORTE_PUBLICO');
      expect(mapWizardMovilidadToDb('aplicativo')).toBe('AUTO');
      expect(mapWizardMovilidadToDb(null)).toBe('CAMINANDO');
      expect(mapWizardMovilidadToDb(undefined)).toBe('CAMINANDO');
    });
  });

  describe('validarInputSolicitud', () => {
    const baseInput: GuardarSolicitudPlanInput = {
      userId: 'user-uuid-1234',
      inicioLatitud: -12.046374,
      inicioLongitud: -77.042793,
      fechaHoraInicio: '2026-10-15T10:00:00.000Z',
      fechaHoraFin: '2026-10-15T14:00:00.000Z',
      gastoMin: 0,
      gastoMax: 50,
      movilidad: 'CAMINANDO',
    };

    it('acepta una entrada válida', () => {
      expect(validarInputSolicitud(baseInput)).toBeNull();
    });

    it('rechaza si falta el userId (AUTH_REQUIRED)', () => {
      const res = validarInputSolicitud({ ...baseInput, userId: '' });
      expect(res?.type).toBe('AUTH_REQUIRED');
    });

    it('rechaza coordenadas de latitud fuera de rango [-90, 90]', () => {
      const res = validarInputSolicitud({ ...baseInput, inicioLatitud: 120 });
      expect(res?.type).toBe('VALIDATION_ERROR');
      expect(res?.message).toContain('latitud');
    });

    it('rechaza coordenadas de longitud fuera de rango [-180, 180]', () => {
      const res = validarInputSolicitud({ ...baseInput, inicioLongitud: -200 });
      expect(res?.type).toBe('VALIDATION_ERROR');
      expect(res?.message).toContain('longitud');
    });

    it('rechaza si fechaHoraFin <= fechaHoraInicio', () => {
      const res = validarInputSolicitud({
        ...baseInput,
        fechaHoraInicio: '2026-10-15T14:00:00.000Z',
        fechaHoraFin: '2026-10-15T10:00:00.000Z',
      });
      expect(res?.type).toBe('VALIDATION_ERROR');
      expect(res?.message).toContain('posterior');
    });

    it('rechaza presupuestos negativos', () => {
      const res = validarInputSolicitud({ ...baseInput, gastoMax: -10 });
      expect(res?.type).toBe('VALIDATION_ERROR');
      expect(res?.message).toContain('negativo');
    });

    it('valida coordenadas requeridas cuando tipoPuntoFinal es OTRA_UBICACION', () => {
      const res = validarInputSolicitud({
        ...baseInput,
        tipoPuntoFinal: 'OTRA_UBICACION',
        finalLatitud: undefined,
        finalLongitud: undefined,
      });
      expect(res?.type).toBe('VALIDATION_ERROR');
      expect(res?.message).toContain('personalizado');
    });
  });

  describe('resolveCategoryIds', () => {
    it('resuelve nombres a UUIDs existentes en la base de datos', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'cat-uuid-gastro', nombre: 'Gastronomía' },
                { id: 'cat-uuid-cult', nombre: 'Cultura' },
                { id: 'cat-uuid-nat', nombre: 'Naturaleza' },
              ],
              error: null,
            }),
          }),
        }),
      } as unknown as typeof import('@/lib/supabase').supabase;

      const ids = await resolveCategoryIds(['Gastronomía', 'cultura', 'Inexistente'], mockClient);
      expect(ids).toContain('cat-uuid-gastro');
      expect(ids).toContain('cat-uuid-cult');
      expect(ids).not.toContain('Inexistente');
      expect(ids.length).toBe(2);
    });

    it('preserva UUIDs directos sin consultar la base de datos innecesariamente', async () => {
      const directUuid = '11111111-2222-3333-4444-555555555555';
      const ids = await resolveCategoryIds([directUuid]);
      expect(ids).toEqual([directUuid]);
    });

    it('devuelve arreglo vacío si la lista de intereses está vacía', async () => {
      const ids = await resolveCategoryIds([]);
      expect(ids).toEqual([]);
    });
  });

  describe('guardarSolicitudPlan - Flujo de Éxito', () => {
    it('inserta en solicitudes_plan y en solicitudes_plan_categorias retornando el UUID persistido', async () => {
      const insertedRow = {
        id: 'solicitud-uuid-9999',
        usuario_id: 'user-uuid-1234',
        fecha_hora_inicio: '2026-10-15T10:00:00.000Z',
        fecha_hora_fin: '2026-10-15T14:00:00.000Z',
        inicio_latitud: -12.046374,
        inicio_longitud: -77.042793,
        inicio_descripcion: 'Plaza Mayor de Lima',
        tipo_punto_final: 'REGRESAR_INICIO',
        final_latitud: null,
        final_longitud: null,
        final_descripcion: null,
        gasto_min: 0,
        gasto_max: 60,
        movilidad: 'CAMINANDO',
        fecha_creacion: '2026-10-15T09:59:00.000Z',
      };

      const mockSingle = vi.fn().mockResolvedValue({ data: insertedRow, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsertSolicitud = vi.fn().mockReturnValue({ select: mockSelect });

      const mockInsertCategorias = vi.fn().mockResolvedValue({ error: null });

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'solicitudes_plan') {
            return {
              insert: mockInsertSolicitud,
            };
          }
          if (table === 'solicitudes_plan_categorias') {
            return {
              insert: mockInsertCategorias,
            };
          }
          return {};
        }),
      } as unknown as typeof import('@/lib/supabase').supabase;

      const input: GuardarSolicitudPlanInput = {
        userId: 'user-uuid-1234',
        inicioLatitud: -12.046374,
        inicioLongitud: -77.042793,
        inicioDescripcion: 'Plaza Mayor de Lima',
        fechaHoraInicio: '2026-10-15T10:00:00.000Z',
        fechaHoraFin: '2026-10-15T14:00:00.000Z',
        tipoPuntoFinal: 'REGRESAR_INICIO',
        gastoMin: 0,
        gastoMax: 60,
        movilidad: 'CAMINANDO',
        categoriaIds: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', '11111111-2222-3333-4444-555555555555'],
        forceNew: true,
      };

      const res = await guardarSolicitudPlan(input, mockClient);

      expect(res.error).toBeNull();
      expect(res.data?.id).toBe('solicitud-uuid-9999');
      expect(mockInsertSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          usuario_id: 'user-uuid-1234',
          tipo_punto_final: 'REGRESAR_INICIO',
          final_latitud: null,
          final_longitud: null,
          movilidad: 'CAMINANDO',
        }),
      );
      expect(mockInsertCategorias).toHaveBeenCalledWith([
        { solicitud_id: 'solicitud-uuid-9999', categoria_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
        { solicitud_id: 'solicitud-uuid-9999', categoria_id: '11111111-2222-3333-4444-555555555555' },
      ]);
    });
  });

  describe('guardarSolicitudPlan - Manejo de Errores RLS y Red', () => {
    it('captura error de permisos RLS (42501 / policy) y no confirma éxito', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "solicitudes_plan"',
        },
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      const mockClient = {
        from: vi.fn().mockReturnValue({ insert: mockInsert }),
      } as unknown as typeof import('@/lib/supabase').supabase;

      const input: GuardarSolicitudPlanInput = {
        userId: 'unauthorized-user',
        inicioLatitud: -12.046374,
        inicioLongitud: -77.042793,
        fechaHoraInicio: '2026-10-15T10:00:00.000Z',
        fechaHoraFin: '2026-10-15T14:00:00.000Z',
        movilidad: 'CAMINANDO',
        forceNew: true,
      };

      const res = await guardarSolicitudPlan(input, mockClient);

      expect(res.data).toBeNull();
      expect(res.error?.type).toBe('PERMISSION_DENIED');
      expect(res.error?.message).toContain('permisos');
    });

    it('captura error de red y no confirma éxito', async () => {
      const mockSingle = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      const mockClient = {
        from: vi.fn().mockReturnValue({ insert: mockInsert }),
      } as unknown as typeof import('@/lib/supabase').supabase;

      const input: GuardarSolicitudPlanInput = {
        userId: 'user-uuid-1234',
        inicioLatitud: -12.046374,
        inicioLongitud: -77.042793,
        fechaHoraInicio: '2026-10-15T10:00:00.000Z',
        fechaHoraFin: '2026-10-15T14:00:00.000Z',
        movilidad: 'CAMINANDO',
        forceNew: true,
      };

      const res = await guardarSolicitudPlan(input, mockClient);

      expect(res.data).toBeNull();
      expect(res.error?.type).toBe('NETWORK_ERROR');
      expect(res.error?.message).toContain('conexión');
    });
  });

  describe('guardarSolicitudPlan - Rollback atómico en categorías', () => {
    it('elimina la solicitud huérfana si la inserción de categorías falla', async () => {
      const insertedRow = { id: 'solicitud-rollback-123', usuario_id: 'user-uuid-1234' };
      const mockSingle = vi.fn().mockResolvedValue({ data: insertedRow, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsertSolicitud = vi.fn().mockReturnValue({ select: mockSelect });

      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });

      const mockInsertCategorias = vi.fn().mockResolvedValue({
        error: { code: '23503', message: 'foreign key violation' },
      });

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'solicitudes_plan') {
            return {
              insert: mockInsertSolicitud,
              delete: mockDelete,
            };
          }
          if (table === 'solicitudes_plan_categorias') {
            return {
              insert: mockInsertCategorias,
            };
          }
          return {};
        }),
      } as unknown as typeof import('@/lib/supabase').supabase;

      const input: GuardarSolicitudPlanInput = {
        userId: 'user-uuid-1234',
        inicioLatitud: -12.046374,
        inicioLongitud: -77.042793,
        fechaHoraInicio: '2026-10-15T10:00:00.000Z',
        fechaHoraFin: '2026-10-15T14:00:00.000Z',
        movilidad: 'CAMINANDO',
        categoriaIds: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
        forceNew: true,
      };

      const res = await guardarSolicitudPlan(input, mockClient);

      expect(res.data).toBeNull();
      expect(res.error).not.toBeNull();
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteEq).toHaveBeenCalledWith('id', 'solicitud-rollback-123');
    });
  });

  describe('Deduplicación e Idempotencia', () => {
    it('evita llamadas duplicadas en vuelo ante doble pulsación simultánea', async () => {
      let resolveInsert: (val: any) => void;
      const delayedPromise = new Promise((resolve) => {
        resolveInsert = resolve;
      });

      const mockSingle = vi.fn().mockReturnValue(delayedPromise);
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      const mockClient = {
        from: vi.fn().mockReturnValue({ insert: mockInsert }),
      } as unknown as typeof import('@/lib/supabase').supabase;

      const input: GuardarSolicitudPlanInput = {
        userId: 'user-uuid-1234',
        inicioLatitud: -12.046374,
        inicioLongitud: -77.042793,
        fechaHoraInicio: '2026-10-15T10:00:00.000Z',
        fechaHoraFin: '2026-10-15T14:00:00.000Z',
        movilidad: 'CAMINANDO',
      };

      // Disparar dos llamadas simultáneas
      const call1 = guardarSolicitudPlan(input, mockClient);
      const call2 = guardarSolicitudPlan(input, mockClient);

      // Resolver la respuesta de la base de datos
      resolveInsert!({
        data: { id: 'solicitud-dedup-1', usuario_id: 'user-uuid-1234' },
        error: null,
      });

      const [res1, res2] = await Promise.all([call1, call2]);

      expect(res1.data?.id).toBe('solicitud-dedup-1');
      expect(res2.data?.id).toBe('solicitud-dedup-1');
      // Solo una llamada a insert en Supabase
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('reutiliza el registro guardado en la misma sesión si la solicitud no cambió', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'solicitud-cached-77', usuario_id: 'user-uuid-1234' },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      const mockClient = {
        from: vi.fn().mockReturnValue({ insert: mockInsert }),
      } as unknown as typeof import('@/lib/supabase').supabase;

      const input: GuardarSolicitudPlanInput = {
        userId: 'user-uuid-1234',
        inicioLatitud: -12.046374,
        inicioLongitud: -77.042793,
        fechaHoraInicio: '2026-10-15T10:00:00.000Z',
        fechaHoraFin: '2026-10-15T14:00:00.000Z',
        movilidad: 'CAMINANDO',
      };

      const res1 = await guardarSolicitudPlan(input, mockClient);
      const res2 = await guardarSolicitudPlan(input, mockClient);

      expect(res1.data?.id).toBe('solicitud-cached-77');
      expect(res2.data?.id).toBe('solicitud-cached-77');
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('guardarSolicitudPlanFromWizard', () => {
    it('reutiliza solicitudId existente en el wizard si no ha cambiado', async () => {
      const mockClient = {
        from: vi.fn(),
      } as unknown as typeof import('@/lib/supabase').supabase;

      const wizardReq: WizardPlanRequest = {
        ubicacion: { modo: 'gps', nombre: 'Parque Kennedy', lat: -12.122, lng: -77.031 },
        minutosTotales: 120,
        horaInicio: '10:00',
        horaFin: '12:00',
        presupuesto: 50,
        intereses: [],
        movilidad: 'caminando',
        solicitudId: 'solicitud-existente-uuid',
      };

      const res = await guardarSolicitudPlanFromWizard({
        request: wizardReq,
        userId: 'user-123',
        client: mockClient,
      });

      expect(res.error).toBeNull();
      expect(res.data?.id).toBe('solicitud-existente-uuid');
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('rechaza si el usuario no está autenticado', async () => {
      const wizardReq: WizardPlanRequest = {
        ubicacion: { modo: 'gps', nombre: 'Parque Kennedy', lat: -12.122, lng: -77.031 },
        minutosTotales: 120,
        horaInicio: '10:00',
        horaFin: '12:00',
        presupuesto: 50,
        intereses: [],
        movilidad: 'caminando',
      };

      const res = await guardarSolicitudPlanFromWizard({
        request: wizardReq,
        userId: '',
      });

      expect(res.data).toBeNull();
      expect(res.error?.type).toBe('AUTH_REQUIRED');
    });
  });

  describe('listarSolicitudesHistorial', () => {
    const makeRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'solicitud-uuid-1',
      usuario_id: 'user-uuid-1234',
      fecha_hora_inicio: '2026-10-15T10:00:00.000Z',
      fecha_hora_fin: '2026-10-15T14:00:00.000Z',
      inicio_latitud: -12.046374,
      inicio_longitud: -77.042793,
      inicio_descripcion: 'Plaza Mayor de Lima',
      tipo_punto_final: 'REGRESAR_INICIO',
      final_latitud: null,
      final_longitud: null,
      final_descripcion: null,
      gasto_min: 0,
      gasto_max: 60,
      movilidad: 'CAMINANDO',
      fecha_creacion: '2026-10-15T09:59:00.000Z',
      solicitudes_plan_categorias: [
        { categorias: { nombre: 'Gastronomía' } },
        { categorias: { nombre: 'Cultura' } },
      ],
      expediciones_plan: null,
      ...overrides,
    });

    const makeClient = (result: { data?: unknown; error?: unknown }) => {
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
    };

    it('consulta por usuario, ordena por fecha_creacion desc y aplana las categorías', async () => {
      const { client, from, select, eq, order } = makeClient({ data: [makeRow()], error: null });

      const res = await listarSolicitudesHistorial('user-uuid-1234', client);

      expect(res.error).toBeNull();
      expect(res.data).toHaveLength(1);
      expect(res.data[0]).toMatchObject({
        id: 'solicitud-uuid-1',
        inicio_descripcion: 'Plaza Mayor de Lima',
        categorias: ['Gastronomía', 'Cultura'],
        expedicion: null,
      });
      expect(res.data[0]).not.toHaveProperty('solicitudes_plan_categorias');
      expect(res.data[0]).not.toHaveProperty('expediciones_plan');
      expect(from).toHaveBeenCalledWith('solicitudes_plan');
      expect(select).toHaveBeenCalledWith(expect.stringContaining('solicitudes_plan_categorias'));
      expect(select).toHaveBeenCalledWith(expect.stringContaining('expediciones_plan'));
      expect(eq).toHaveBeenCalledWith('usuario_id', 'user-uuid-1234');
      expect(order).toHaveBeenCalledWith('fecha_creacion', { ascending: false });
    });

    it('aplana la expedición embebida y normaliza sus arrays de paradas', async () => {
      const snapshot = {
        id: 'plan-uuid-1',
        titulo: 'Ruta de los soles',
        variante: 'equilibrado',
        paradas: [],
        duracion_total_min: 180,
        costo_total: 45,
        distancia_km_aprox: 3.2,
      };
      const { client } = makeClient({
        data: [
          makeRow({
            expediciones_plan: {
              estado_expedicion: 'PARCIAL',
              completado_en: '2026-10-15T18:30:00.000Z',
              plan_snapshot: snapshot,
              paradas_visitadas: [1, 3],
              paradas_visitadas_ids: null,
            },
          }),
        ],
        error: null,
      });

      const res = await listarSolicitudesHistorial('user-uuid-1234', client);

      expect(res.error).toBeNull();
      expect(res.data[0].expedicion).toEqual({
        estado_expedicion: 'PARCIAL',
        completado_en: '2026-10-15T18:30:00.000Z',
        plan_snapshot: snapshot,
        paradas_visitadas: [1, 3],
        paradas_visitadas_ids: [],
      });
    });

    it('devuelve categorías vacías cuando la solicitud no tiene ninguna', async () => {
      const { client } = makeClient({
        data: [makeRow({ solicitudes_plan_categorias: null })],
        error: null,
      });

      const res = await listarSolicitudesHistorial('user-uuid-1234', client);

      expect(res.error).toBeNull();
      expect(res.data[0].categorias).toEqual([]);
    });

    it('devuelve [] con error clasificado si la consulta es rechazada por RLS', async () => {
      const { client } = makeClient({
        data: null,
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "solicitudes_plan"',
        },
      });

      const res = await listarSolicitudesHistorial('user-uuid-1234', client);

      expect(res.data).toEqual([]);
      expect(res.error?.type).toBe('PERMISSION_DENIED');
    });

    it('devuelve [] con error clasificado si la consulta lanza excepción de red', async () => {
      const { client } = makeClient({});
      client.from = vi.fn(() => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof client.from;

      const res = await listarSolicitudesHistorial('user-uuid-1234', client);

      expect(res.data).toEqual([]);
      expect(res.error?.type).toBe('NETWORK_ERROR');
    });

    it('rechaza sin sesión (AUTH_REQUIRED) sin consultar', async () => {
      const { client, from } = makeClient({ data: [], error: null });

      const res = await listarSolicitudesHistorial('', client);

      expect(res.data).toEqual([]);
      expect(res.error?.type).toBe('AUTH_REQUIRED');
      expect(from).not.toHaveBeenCalled();
    });
  });
});
