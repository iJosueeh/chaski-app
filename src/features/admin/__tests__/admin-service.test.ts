import { describe, expect, it, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  sanitizeAdminError,
  fetchAdminUsers,
  fetchAdminMetrics,
  changeUserAccountStatus,
} from '../services/admin.service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('admin.service - Servicios de Administración (Serie AX)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeAdminError', () => {
    it('devuelve mensaje por defecto cuando el error es nulo o indefinido', () => {
      expect(sanitizeAdminError(null)).toBe('Error inesperado');
      expect(sanitizeAdminError(undefined)).toBe('Error inesperado');
    });

    it('traduce AUTH_UNAUTHORIZED y código 42501', () => {
      expect(sanitizeAdminError({ message: 'AUTH_UNAUTHORIZED: admin role needed' })).toBe(
        'Acceso denegado: Se requieren privilegios de administrador.'
      );
      expect(sanitizeAdminError({ code: '42501', message: 'permission denied' })).toBe(
        'Acceso denegado: Se requieren privilegios de administrador.'
      );
    });

    it('traduce AUTH_REQUIRED y código 28000', () => {
      expect(sanitizeAdminError({ message: 'AUTH_REQUIRED: no session' })).toBe(
        'Sesión no válida o expirada. Inicia sesión nuevamente.'
      );
      expect(sanitizeAdminError({ code: '28000', message: 'invalid session' })).toBe(
        'Sesión no válida o expirada. Inicia sesión nuevamente.'
      );
    });

    it('traduce CANNOT_DEACTIVATE_SELF', () => {
      expect(sanitizeAdminError({ message: 'CANNOT_DEACTIVATE_SELF: no self lock' })).toBe(
        'No puedes desactivar tu propia cuenta de administrador.'
      );
    });

    it('traduce LAST_ADMIN_PROTECTION', () => {
      expect(
        sanitizeAdminError({ message: 'LAST_ADMIN_PROTECTION: cannot deactivate only admin' })
      ).toBe('Operación rechazada: No se puede desactivar al único administrador activo del sistema.');
    });

    it('traduce USER_NOT_FOUND y código P0002', () => {
      expect(sanitizeAdminError({ message: 'USER_NOT_FOUND' })).toBe(
        'El usuario especificado no fue encontrado.'
      );
      expect(sanitizeAdminError({ code: 'P0002', message: 'no data' })).toBe(
        'El usuario especificado no fue encontrado.'
      );
    });

    it('traduce PGRST202 o función no encontrada (migración pendiente)', () => {
      expect(
        sanitizeAdminError({
          code: 'PGRST202',
          message: 'Could not find the function public.admin_get_users in the schema cache',
        })
      ).toBe('Las funciones administrativas de base de datos aún no han sido desplegadas en el servidor.');
    });

    it('traduce fallos de conexión y red', () => {
      expect(sanitizeAdminError({ message: 'Network request failed' })).toBe(
        'Error de conexión con el servidor. Verifica tu conexión a internet.'
      );
      expect(sanitizeAdminError(new Error('Failed to fetch'))).toBe(
        'Error de conexión con el servidor. Verifica tu conexión a internet.'
      );
    });

    it('conserva el mensaje original si no coincide con un patrón conocido', () => {
      expect(sanitizeAdminError({ message: 'Algún error no contemplado' })).toBe(
        'Algún error no contemplado'
      );
      expect(sanitizeAdminError('Mensaje como string')).toBe('Mensaje como string');
    });
  });

  describe('fetchAdminUsers', () => {
    it('envía los parámetros normalizados a la RPC admin_get_users', async () => {
      const mockRows = [
        {
          id: 'u-1',
          nombre: 'Chaski Admin',
          email: 'admin@chaski.pe',
          rol: 'ADMIN',
          estado: true,
          fecha_registro: '2026-02-01T00:00:00Z',
          total_count: '2',
        },
        {
          id: 'u-2',
          nombre: 'Estudiante Explorador',
          email: 'estudiante@chaski.pe',
          rol: 'USUARIO',
          estado: false,
          fecha_registro: '2026-02-02T00:00:00Z',
          total_count: '2',
        },
      ];

      (supabase.rpc as any).mockResolvedValue({
        data: mockRows,
        error: null,
      });

      const res = await fetchAdminUsers({
        search: '  Chaski  ',
        limit: 15,
        offset: 0,
        filtroRol: 'ADMIN',
        filtroEstado: true,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('admin_get_users', {
        p_search: 'Chaski',
        p_limit: 15,
        p_offset: 0,
        p_filtro_rol: 'ADMIN',
        p_filtro_estado: true,
      });

      expect(res.data).toBeDefined();
      expect(res.data?.totalCount).toBe(2);
      expect(res.data?.users).toHaveLength(2);
      expect(res.data?.users[0].rol).toBe('ADMIN');
      expect(res.data?.users[1].estado).toBe(false);
    });

    it('limita los parámetros extremos de paginación', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: [],
        error: null,
      });

      await fetchAdminUsers({
        limit: 9999, // Supera el límite de 100
        offset: -10, // Menor que 0
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'admin_get_users',
        expect.objectContaining({
          p_limit: 100,
          p_offset: 0,
        })
      );
    });

    it('devuelve totalCount: 0 cuando no hay resultados', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: [],
        error: null,
      });

      const res = await fetchAdminUsers({ search: 'Inexistente' });
      expect(res.data).toEqual({ users: [], totalCount: 0 });
      expect(res.error).toBeUndefined();
    });

    it('captura y sanitiza errores devueltos por la RPC', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'AUTH_UNAUTHORIZED' },
      });

      const res = await fetchAdminUsers();
      expect(res.data).toBeNull();
      expect(res.error).toBe('Acceso denegado: Se requieren privilegios de administrador.');
    });

    it('maneja excepciones inesperadas', async () => {
      (supabase.rpc as any).mockRejectedValue(new Error('PGRST202: function not found'));

      const res = await fetchAdminUsers();
      expect(res.data).toBeNull();
      expect(res.error).toBe(
        'Las funciones administrativas de base de datos aún no han sido desplegadas en el servidor.'
      );
    });
  });

  describe('fetchAdminMetrics', () => {
    it('obtiene y normaliza métricas del dashboard administrativo', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          total_usuarios: 50,
          usuarios_activos: 45,
          usuarios_inactivos: 5,
          total_administradores: 3,
          timestamp: '2026-10-14T10:00:00Z',
        },
        error: null,
      });

      const res = await fetchAdminMetrics();
      expect(supabase.rpc).toHaveBeenCalledWith('admin_get_metrics');
      expect(res.data).toEqual({
        total_usuarios: 50,
        usuarios_activos: 45,
        usuarios_inactivos: 5,
        total_administradores: 3,
        timestamp: '2026-10-14T10:00:00Z',
      });
      expect(res.error).toBeUndefined();
    });

    it('maneja respuestas vacías o no válidas', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: null,
      });

      const res = await fetchAdminMetrics();
      expect(res.data).toBeNull();
      expect(res.error).toBe('Respuesta de métricas no válida');
    });

    it('sanitiza errores de privilegios al consultar métricas', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'AUTH_UNAUTHORIZED' },
      });

      const res = await fetchAdminMetrics();
      expect(res.data).toBeNull();
      expect(res.error).toBe('Acceso denegado: Se requieren privilegios de administrador.');
    });
  });

  describe('changeUserAccountStatus', () => {
    it('rechaza llamadas con targetUserId vacío', async () => {
      const res = await changeUserAccountStatus('', false);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Identificador de usuario no válido');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('ejecuta con éxito la desactivación de un usuario', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          usuario_id: 'target-u-1',
          estado_anterior: true,
          nuevo_estado: false,
          modificado_por: 'admin-id',
        },
        error: null,
      });

      const res = await changeUserAccountStatus('target-u-1', false);

      expect(supabase.rpc).toHaveBeenCalledWith('admin_set_user_status', {
        p_target_user_id: 'target-u-1',
        p_nuevo_estado: false,
      });
      expect(res.success).toBe(true);
      expect(res.usuario_id).toBe('target-u-1');
      expect(res.nuevo_estado).toBe(false);
    });

    it('bloquea auto-desactivación de administrador con mensaje amigable', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'CANNOT_DEACTIVATE_SELF: An admin cannot deactivate their own account' },
      });

      const res = await changeUserAccountStatus('my-own-admin-id', false);

      expect(res.success).toBe(false);
      expect(res.error).toBe('No puedes desactivar tu propia cuenta de administrador.');
    });

    it('bloquea la desactivación del último administrador activo', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'LAST_ADMIN_PROTECTION: Cannot deactivate the only active administrator' },
      });

      const res = await changeUserAccountStatus('last-admin-id', false);

      expect(res.success).toBe(false);
      expect(res.error).toBe(
        'Operación rechazada: No se puede desactivar al único administrador activo del sistema.'
      );
    });

    it('maneja fallos de red al cambiar estado', async () => {
      (supabase.rpc as any).mockRejectedValue(new Error('Network request failed'));

      const res = await changeUserAccountStatus('target-u-1', true);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Error de conexión con el servidor. Verifica tu conexión a internet.');
    });
  });
});
