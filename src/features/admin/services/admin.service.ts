import { supabase } from '@/lib/supabase';
import { sanitizeAdminError } from '@/shared/utils/sanitize-admin-error';
import type {
  AdminAnonymizeUserResult,
  AdminExpedicion,
  AdminGetExpedicionesResult,
  AdminGetSolicitudesResult,
  AdminGetUsersResult,
  AdminMetrics,
  AdminMutationResult,
  AdminPlansFilter,
  AdminSetStatusResult,
  AdminSolicitud,
  AdminUpdateUserInput,
  AdminUpdateUserResult,
  AdminUser,
  AdminUsersFilter,
} from '../interfaces/admin.interface';
import {
  normalizeUserName,
  validateAdminUserInput,
} from '../utils/admin-validation';

/**
 * Forma cruda de las filas que devuelven las RPC de listado. Se declaran aquí
 * (y no en `interfaces/`) porque son un detalle interno de este servicio: los
 * consumidores solo ven los tipos `Admin*` ya normalizados.
 */
interface AdminUserRow {
  id: string;
  nombre: string | null;
  email: string | null;
  rol: string | null;
  estado: boolean | null;
  fecha_registro: string;
  total_count?: number | string;
}

interface SolicitudRow {
  id: string;
  usuario_id: string;
  usuario_nombre: string | null;
  usuario_email: string | null;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  inicio_descripcion: string | null;
  tipo_punto_final: string | null;
  movilidad: string | null;
  gasto_max: number | string | null;
  fecha_creacion: string;
  categorias: string | null;
  estado_expedicion: string | null;
  total_count?: number | string;
}

interface ExpedicionRow {
  solicitud_id: string;
  usuario_id: string;
  usuario_nombre: string | null;
  usuario_email: string | null;
  estado_expedicion: string | null;
  completado_en: string | null;
  total_paradas: number | string | null;
  visitadas: number | string | null;
  titulo_plan: string | null;
  total_count?: number | string;
}

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

    const rows = (Array.isArray(data) ? data : []) as unknown as AdminUserRow[];
    const totalCount = rows.length > 0 && rows[0]?.total_count ? Number(rows[0].total_count) : 0;

    const users: AdminUser[] = rows.map((row) => ({
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

/* ── CRUD administrativo (Fase 1 · APF3) ────────────────────────────────── */

/**
 * Edita nombre, rol y estado de un usuario.
 * Valida en cliente (mismos límites que la BD) y delega en `admin_update_user`,
 * que vuelve a validar y aplica las salvaguardas de último administrador.
 */
export async function updateAdminUser(
  input: AdminUpdateUserInput,
): Promise<AdminUpdateUserResult> {
  const validationError = validateAdminUserInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const { data, error } = await supabase.rpc('admin_update_user', {
      p_target_user_id: input.id,
      p_nombre: normalizeUserName(input.nombre),
      p_rol: input.rol,
      p_estado: input.estado,
    });

    if (error) {
      return { success: false, error: sanitizeAdminError(error) };
    }

    return {
      success: true,
      usuario_id: data?.usuario_id ?? input.id,
      nombre_anterior: data?.nombre_anterior,
      nombre_nuevo: data?.nombre_nuevo ?? input.nombre,
      rol_anterior: data?.rol_anterior,
      rol_nuevo: data?.rol_nuevo ?? input.rol,
      estado_anterior: data?.estado_anterior,
      estado_nuevo: data?.estado_nuevo ?? input.estado,
    };
  } catch (err: any) {
    return { success: false, error: sanitizeAdminError(err) };
  }
}

/**
 * Baja definitiva de un usuario: anonimiza el nombre y desactiva el acceso.
 * NO borra la fila: el proyecto revoca DELETE sobre public.usuarios.
 */
export async function anonymizeAdminUser(
  targetUserId: string,
): Promise<AdminAnonymizeUserResult> {
  if (!targetUserId) {
    return { success: false, error: 'Identificador de usuario no válido.' };
  }

  try {
    const { data, error } = await supabase.rpc('admin_anonymize_user', {
      p_target_user_id: targetUserId,
    });

    if (error) {
      return { success: false, error: sanitizeAdminError(error) };
    }

    return {
      success: true,
      usuario_id: data?.usuario_id ?? targetUserId,
      nombre_anterior: data?.nombre_anterior,
      nombre_nuevo: data?.nombre_nuevo,
    };
  } catch (err: any) {
    return { success: false, error: sanitizeAdminError(err) };
  }
}

/** Lista todas las solicitudes de plan (todos los usuarios). */
export async function fetchAdminSolicitudes(
  filter: AdminPlansFilter = {},
): Promise<{ data: AdminGetSolicitudesResult | null; error?: string }> {
  const search = filter.search?.trim() ? filter.search.trim() : null;
  const limit = Math.max(1, Math.min(filter.limit ?? 20, 100));
  const offset = Math.max(0, filter.offset ?? 0);

  try {
    const { data, error } = await supabase.rpc('admin_get_solicitudes', {
      p_search: search,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return { data: null, error: sanitizeAdminError(error) };
    }

    const rows = (Array.isArray(data) ? data : []) as unknown as SolicitudRow[];
    const totalCount =
      rows.length > 0 && rows[0]?.total_count ? Number(rows[0].total_count) : 0;

    const solicitudes: AdminSolicitud[] = rows.map((row) => ({
      id: row.id,
      usuario_id: row.usuario_id,
      usuario_nombre: row.usuario_nombre ?? '',
      usuario_email: row.usuario_email ?? '',
      fecha_hora_inicio: row.fecha_hora_inicio,
      fecha_hora_fin: row.fecha_hora_fin,
      inicio_descripcion: row.inicio_descripcion ?? null,
      tipo_punto_final: row.tipo_punto_final ?? 'REGRESAR_INICIO',
      movilidad: row.movilidad ?? 'CAMINANDO',
      gasto_max: row.gasto_max !== null && row.gasto_max !== undefined ? Number(row.gasto_max) : null,
      fecha_creacion: row.fecha_creacion,
      categorias: row.categorias ?? 'Sin intereses',
      estado_expedicion: row.estado_expedicion ?? null,
    }));

    return { data: { solicitudes, totalCount } };
  } catch (err: any) {
    return { data: null, error: sanitizeAdminError(err) };
  }
}

/** Elimina una solicitud de plan (cascada a categorías y expedición). */
export async function deleteAdminSolicitud(
  solicitudId: string,
): Promise<AdminMutationResult> {
  if (!solicitudId) {
    return { success: false, error: 'Identificador de solicitud no válido.' };
  }

  try {
    const { error } = await supabase.rpc('admin_delete_solicitud', {
      p_solicitud_id: solicitudId,
    });

    if (error) {
      return { success: false, error: sanitizeAdminError(error) };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: sanitizeAdminError(err) };
  }
}

/** Lista las expediciones registradas (historial de todos los usuarios). */
export async function fetchAdminExpediciones(
  filter: AdminPlansFilter = {},
): Promise<{ data: AdminGetExpedicionesResult | null; error?: string }> {
  const search = filter.search?.trim() ? filter.search.trim() : null;
  const limit = Math.max(1, Math.min(filter.limit ?? 20, 100));
  const offset = Math.max(0, filter.offset ?? 0);

  try {
    const { data, error } = await supabase.rpc('admin_get_expediciones', {
      p_search: search,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return { data: null, error: sanitizeAdminError(error) };
    }

    const rows = (Array.isArray(data) ? data : []) as unknown as ExpedicionRow[];
    const totalCount =
      rows.length > 0 && rows[0]?.total_count ? Number(rows[0].total_count) : 0;

    const expediciones: AdminExpedicion[] = rows.map((row) => ({
      solicitud_id: row.solicitud_id,
      usuario_id: row.usuario_id,
      usuario_nombre: row.usuario_nombre ?? '',
      usuario_email: row.usuario_email ?? '',
      estado_expedicion: row.estado_expedicion ?? 'EN_CURSO',
      completado_en: row.completado_en,
      total_paradas: Number(row.total_paradas ?? 0),
      visitadas: Number(row.visitadas ?? 0),
      titulo_plan: row.titulo_plan ?? 'Sin título',
    }));

    return { data: { expediciones, totalCount } };
  } catch (err: any) {
    return { data: null, error: sanitizeAdminError(err) };
  }
}

/** Elimina el registro de expedición de una solicitud. */
export async function deleteAdminExpedicion(
  solicitudId: string,
): Promise<AdminMutationResult> {
  if (!solicitudId) {
    return { success: false, error: 'Identificador de expedición no válido.' };
  }

  try {
    const { error } = await supabase.rpc('admin_delete_expedicion', {
      p_solicitud_id: solicitudId,
    });

    if (error) {
      return { success: false, error: sanitizeAdminError(error) };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: sanitizeAdminError(err) };
  }
}
