import { supabase } from '@/lib/supabase';
import { sanitizeAdminError } from '@/shared/utils/sanitize-admin-error';
import type {
  AdminGetUsersResult,
  AdminMetrics,
  AdminSetStatusResult,
  AdminUser,
  AdminUsersFilter,
} from '../interfaces/admin.interface';

export { sanitizeAdminError };

export async function fetchAdminUsers(
  filter: AdminUsersFilter = {}
): Promise<{ data: AdminGetUsersResult | null; error?: string }> {
  const search = filter.search?.trim() ? filter.search.trim() : null;
  const limit = Math.max(1, Math.min(filter.limit ?? 20, 100));
  const offset = Math.max(0, filter.offset ?? 0);
  const filtroRol = filter.filtroRol ?? null;
  const filtroEstado = filter.filtroEstado !== undefined ? filter.filtroEstado : null;

  try {
    const { data, error } = await supabase.rpc('admin_get_users', {
      p_search: search,
      p_limit: limit,
      p_offset: offset,
      p_filtro_rol: filtroRol,
      p_filtro_estado: filtroEstado,
    });

    if (error) {
      return { data: null, error: sanitizeAdminError(error) };
    }

    const rows = Array.isArray(data) ? data : [];
    const totalCount = rows.length > 0 && rows[0]?.total_count ? Number(rows[0].total_count) : 0;

    const users: AdminUser[] = rows.map((row: any) => ({
      id: row.id,
      nombre: row.nombre ?? '',
      email: row.email ?? '',
      rol: row.rol === 'ADMIN' ? 'ADMIN' : 'USUARIO',
      estado: Boolean(row.estado),
      fecha_registro: row.fecha_registro,
    }));

    return {
      data: {
        users,
        totalCount,
      },
    };
  } catch (err: any) {
    return { data: null, error: sanitizeAdminError(err) };
  }
}

export async function fetchAdminMetrics(): Promise<{
  data: AdminMetrics | null;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('admin_get_metrics');

    if (error) {
      return { data: null, error: sanitizeAdminError(error) };
    }

    if (!data || typeof data !== 'object') {
      return { data: null, error: 'Respuesta de métricas no válida' };
    }

    const metrics: AdminMetrics = {
      total_usuarios: Number(data.total_usuarios ?? 0),
      usuarios_activos: Number(data.usuarios_activos ?? 0),
      usuarios_inactivos: Number(data.usuarios_inactivos ?? 0),
      total_administradores: Number(data.total_administradores ?? 0),
      timestamp: data.timestamp ?? new Date().toISOString(),
    };

    return { data: metrics };
  } catch (err: any) {
    return { data: null, error: sanitizeAdminError(err) };
  }
}

export async function changeUserAccountStatus(
  targetUserId: string,
  newStatus: boolean
): Promise<AdminSetStatusResult> {
  if (!targetUserId) {
    return { success: false, error: 'Identificador de usuario no válido' };
  }

  try {
    const { data, error } = await supabase.rpc('admin_set_user_status', {
      p_target_user_id: targetUserId,
      p_nuevo_estado: newStatus,
    });

    if (error) {
      return { success: false, error: sanitizeAdminError(error) };
    }

    return {
      success: true,
      usuario_id: data?.usuario_id ?? targetUserId,
      estado_anterior: data?.estado_anterior,
      nuevo_estado: data?.nuevo_estado ?? newStatus,
      modificado_por: data?.modificado_por,
    };
  } catch (err: any) {
    return { success: false, error: sanitizeAdminError(err) };
  }
}
