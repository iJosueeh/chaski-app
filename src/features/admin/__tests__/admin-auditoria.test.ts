import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '@/lib/supabase';

import {
  fetchAdminAcciones,
  fetchAdminBusinessMetrics,
} from '../services/admin.service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const rpcMock = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

describe('auditoría administrativa (Fase 1.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAdminAcciones', () => {
    it('normaliza las filas del historial y toma el total', async () => {
      rpcMock.mockResolvedValueOnce({
        data: [
          {
            id: 'accion-1',
            accion: 'EDITAR_USUARIO',
            objetivo_tipo: 'USUARIO',
            objetivo_id: 'user-9',
            detalle: { antes: { nombre: 'Ana' }, despues: { nombre: 'Ana T.' } },
            creado_en: '2026-11-10T15:00:00Z',
            actor_nombre: 'Keny',
            actor_email: 'keny@utp.edu.pe',
            total_count: '7',
          },
        ],
        error: null,
      });

      const result = await fetchAdminAcciones(15, 0);

      expect(rpcMock).toHaveBeenCalledWith('admin_get_acciones', {
        p_limit: 15,
        p_offset: 0,
      });
      expect(result.error).toBeUndefined();
      expect(result.data?.totalCount).toBe(7);
      expect(result.data?.acciones[0]).toEqual({
        id: 'accion-1',
        accion: 'EDITAR_USUARIO',
        objetivo_tipo: 'USUARIO',
        objetivo_id: 'user-9',
        detalle: { antes: { nombre: 'Ana' }, despues: { nombre: 'Ana T.' } },
        creado_en: '2026-11-10T15:00:00Z',
        actor_nombre: 'Keny',
        actor_email: 'keny@utp.edu.pe',
      });
    });

    it('limita el tamaño de página y evita desplazamientos negativos', async () => {
      rpcMock.mockResolvedValueOnce({ data: [], error: null });

      await fetchAdminAcciones(500, -20);

      expect(rpcMock).toHaveBeenCalledWith('admin_get_acciones', {
        p_limit: 100,
        p_offset: 0,
      });
    });

    it('devuelve una lista vacía con total 0 cuando no hay acciones', async () => {
      rpcMock.mockResolvedValueOnce({ data: [], error: null });

      const result = await fetchAdminAcciones();

      expect(result.data).toEqual({ acciones: [], totalCount: 0 });
    });

    it('traduce el error de la base a un mensaje entendible', async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador' },
      });

      const result = await fetchAdminAcciones();

      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.error).not.toContain('AUTH_UNAUTHORIZED');
    });
  });

  describe('fetchAdminBusinessMetrics', () => {
    it('convierte el JSON en números de la interfaz', async () => {
      rpcMock.mockResolvedValueOnce({
        data: {
          usuarios_total: 2,
          usuarios_activos: 2,
          admins_total: 1,
          solicitudes_total: 3,
          solicitudes_ultimos_7_dias: 3,
          expediciones_total: 1,
          expediciones_completadas: 1,
          paradas_visitadas_total: 4,
          lugares_activos: 20,
          lugares_con_portada: 2,
          imagenes_total: 3,
          gasto_promedio_plan: '85.50',
          acciones_admin_total: 6,
        },
        error: null,
      });

      const result = await fetchAdminBusinessMetrics();

      expect(result.error).toBeUndefined();
      expect(result.data?.gasto_promedio_plan).toBe(85.5);
      expect(result.data?.lugares_activos).toBe(20);
      expect(result.data?.acciones_admin_total).toBe(6);
    });

    it('usa 0 cuando falta una clave en la respuesta', async () => {
      rpcMock.mockResolvedValueOnce({ data: { usuarios_total: 1 }, error: null });

      const result = await fetchAdminBusinessMetrics();

      expect(result.data?.usuarios_total).toBe(1);
      expect(result.data?.solicitudes_total).toBe(0);
      expect(result.data?.acciones_admin_total).toBe(0);
    });

    it('avisa cuando la base no devuelve nada útil', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      const result = await fetchAdminBusinessMetrics();

      expect(result.data).toBeNull();
      expect(result.error).toContain('No se pudieron leer las métricas');
    });
  });
});
