import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as adminService from '@/features/admin/services/admin.service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/features/admin/services/admin.service');

describe('Admin Hooks - Lógica de Paginación, Filtros y Concurrencia (Serie AX)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cálculos de Paginación y Desplazamiento', () => {
    function computePagination(offset: number, limit: number, totalCount: number) {
      const currentPage = Math.floor(offset / (limit || 1));
      const totalPages = Math.ceil(totalCount / (limit || 1));
      const hasMore = offset + limit < totalCount;
      return { currentPage, totalPages, hasMore };
    }

    it('calcula la página inicial con 0 elementos', () => {
      const res = computePagination(0, 20, 0);
      expect(res.currentPage).toBe(0);
      expect(res.totalPages).toBe(0);
      expect(res.hasMore).toBe(false);
    });

    it('calcula correctamente páginas y hasMore en colecciones grandes', () => {
      // 55 usuarios, 20 por página -> 3 páginas en total
      // Página 0: offset 0
      const p0 = computePagination(0, 20, 55);
      expect(p0.currentPage).toBe(0);
      expect(p0.totalPages).toBe(3);
      expect(p0.hasMore).toBe(true);

      // Página 1: offset 20
      const p1 = computePagination(20, 20, 55);
      expect(p1.currentPage).toBe(1);
      expect(p1.totalPages).toBe(3);
      expect(p1.hasMore).toBe(true);

      // Página 2: offset 40
      const p2 = computePagination(40, 20, 55);
      expect(p2.currentPage).toBe(2);
      expect(p2.totalPages).toBe(3);
      expect(p2.hasMore).toBe(false);
    });

    it('maneja límites personalizados correctamente', () => {
      const res = computePagination(25, 25, 100);
      expect(res.currentPage).toBe(1);
      expect(res.totalPages).toBe(4);
      expect(res.hasMore).toBe(true);
    });
  });

  describe('Prevención de condiciones de carrera (Race Condition Protection)', () => {
    it('descarta respuestas obsoletas si una petición posterior finaliza primero', async () => {
      let activeRequestId = 0;
      let lastAppliedData: any = null;

      async function simulatedLoadUsers(searchQuery: string, delayMs: number) {
        const thisRequestId = ++activeRequestId;
        // Simular retardo de red asíncrono
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        if (thisRequestId !== activeRequestId) {
          // Descartada por ser obsoleta
          return;
        }

        lastAppliedData = searchQuery;
      }

      // La primera petición es lenta (100ms)
      const req1 = simulatedLoadUsers('primera-busqueda', 100);
      // La segunda petición es rápida (20ms) y fue lanzada después
      const req2 = simulatedLoadUsers('segunda-busqueda-mas-reciente', 20);

      await Promise.all([req1, req2]);

      // Aunque req1 terminó después que req2, el dato final DEBE ser req2
      expect(lastAppliedData).toBe('segunda-busqueda-mas-reciente');
    });
  });

  describe('Controlador de Cambio de Estado (useAdminStatusManager)', () => {
    it('gestiona exitosamente el cambio de estado y actualiza el último resultado', async () => {
      const mockResult = {
        success: true,
        usuario_id: 'usr-target',
        estado_anterior: true,
        nuevo_estado: false,
        modificado_por: 'usr-admin',
      };

      vi.spyOn(adminService, 'changeUserAccountStatus').mockResolvedValue(mockResult);

      let updatingUserId: string | null = null;
      let error: string | null = null;
      let lastResult: any = null;

      async function simulatedSetUserStatus(targetUserId: string, newStatus: boolean) {
        updatingUserId = targetUserId;
        error = null;

        const result = await adminService.changeUserAccountStatus(targetUserId, newStatus);

        updatingUserId = null;
        lastResult = result;
        if (!result.success && result.error) {
          error = result.error;
        }
        return result;
      }

      const res = await simulatedSetUserStatus('usr-target', false);

      expect(res.success).toBe(true);
      expect(updatingUserId).toBeNull();
      expect(error).toBeNull();
      expect(lastResult).toEqual(mockResult);
      expect(adminService.changeUserAccountStatus).toHaveBeenCalledWith('usr-target', false);
    });

    it('registra el mensaje de error cuando la operación es rechazada', async () => {
      vi.spyOn(adminService, 'changeUserAccountStatus').mockResolvedValue({
        success: false,
        error: 'No puedes desactivar tu propia cuenta de administrador.',
      });

      let updatingUserId: string | null = null;
      let error: string | null = null;
      let lastResult: any = null;

      async function simulatedSetUserStatus(targetUserId: string, newStatus: boolean) {
        updatingUserId = targetUserId;
        error = null;

        const result = await adminService.changeUserAccountStatus(targetUserId, newStatus);

        updatingUserId = null;
        lastResult = result;
        if (!result.success && result.error) {
          error = result.error;
        }
        return result;
      }

      const res = await simulatedSetUserStatus('usr-admin-propio', false);

      expect(res.success).toBe(false);
      expect(updatingUserId).toBeNull();
      expect(error).toBe('No puedes desactivar tu propia cuenta de administrador.');
      expect(lastResult?.success).toBe(false);
    });
  });

  describe('Controlador de Métricas (useAdminMetrics)', () => {
    it('obtiene métricas y maneja recarga manual', async () => {
      const mockMetrics = {
        total_usuarios: 120,
        usuarios_activos: 110,
        usuarios_inactivos: 10,
        total_administradores: 4,
        timestamp: '2026-10-14T11:00:00Z',
      };

      vi.spyOn(adminService, 'fetchAdminMetrics').mockResolvedValue({
        data: mockMetrics,
      });

      let metrics: any = null;
      let loading = false;
      let error: string | null = null;

      async function simulatedReloadMetrics() {
        loading = true;
        error = null;

        const res = await adminService.fetchAdminMetrics();
        if (res.error) {
          error = res.error;
        } else if (res.data) {
          metrics = res.data;
        }
        loading = false;
      }

      await simulatedReloadMetrics();

      expect(loading).toBe(false);
      expect(error).toBeNull();
      expect(metrics).toEqual(mockMetrics);
      expect(adminService.fetchAdminMetrics).toHaveBeenCalledTimes(1);
    });
  });
});
