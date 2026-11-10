/**
 * Definiciones de tipos para el módulo de Administración y Roles (Serie AX).
 *
 * Los tipos de sesión/perfil (`UserRole`, `UserAccountStatus`,
 * `UserProfileRecord`) son propiedad de Auth y se re-exportan aquí para
 * conservar el contrato histórico de este módulo.
 */

import type {
    UserRole,
    UserAccountStatus,
    UserProfileRecord,
} from '@/features/auth/interfaces/auth.interfaces';

export type { UserRole, UserAccountStatus, UserProfileRecord };

/**
 * Representa a un usuario dentro del padrón administrativo de Chaski.
 */
export interface AdminUser {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  estado: boolean;
  fecha_registro: string;
}

/**
 * Respuesta paginada de la RPC admin_get_users.
 */
export interface AdminGetUsersResult {
  users: AdminUser[];
  totalCount: number;
}

/**
 * Parámetros de consulta y filtrado para el listado administrativo.
 */
export interface AdminUsersFilter {
  search?: string;
  limit?: number;
  offset?: number;
  filtroRol?: UserRole | null;
  filtroEstado?: boolean | null;
}

/**
 * Métricas agregadas de intendencia para el dashboard de administración.
 */
export interface AdminMetrics {
  total_usuarios: number;
  usuarios_activos: number;
  usuarios_inactivos: number;
  total_administradores: number;
  timestamp: string;
}

/**
 * Resultado de cambio de estado de cuenta.
 */
export interface AdminSetStatusResult {
  success: boolean;
  usuario_id?: string;
  estado_anterior?: boolean;
  nuevo_estado?: boolean;
  modificado_por?: string;
  error?: string;
}

/** Límites del nombre de usuario, alineados con el CHECK de la base de datos. */
export const ADMIN_NOMBRE_MIN_LENGTH = 2;
export const ADMIN_NOMBRE_MAX_LENGTH = 60;

/** Datos editables de un usuario desde el panel de intendencia. */
export interface AdminUpdateUserInput {
  id: string;
  nombre: string;
  rol: UserRole;
  estado: boolean;
}

/** Resultado de `admin_update_user`. */
export interface AdminUpdateUserResult {
  success: boolean;
  usuario_id?: string;
  nombre_anterior?: string;
  nombre_nuevo?: string;
  rol_anterior?: UserRole;
  rol_nuevo?: UserRole;
  estado_anterior?: boolean;
  estado_nuevo?: boolean;
  error?: string;
}

/** Resultado de `admin_anonymize_user` (baja definitiva sin DELETE físico). */
export interface AdminAnonymizeUserResult {
  success: boolean;
  usuario_id?: string;
  nombre_anterior?: string;
  nombre_nuevo?: string;
  error?: string;
}

/** Fila del listado administrativo de solicitudes de plan. */
export interface AdminSolicitud {
  id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  inicio_descripcion: string | null;
  tipo_punto_final: string;
  movilidad: string;
  gasto_max: number | null;
  fecha_creacion: string;
  categorias: string;
  estado_expedicion: string | null;
}

/** Filtros del listado de solicitudes. */
export interface AdminPlansFilter {
  search?: string;
  limit?: number;
  offset?: number;
}

/** Respuesta paginada de solicitudes. */
export interface AdminGetSolicitudesResult {
  solicitudes: AdminSolicitud[];
  totalCount: number;
}

/** Fila del listado administrativo de expediciones. */
export interface AdminExpedicion {
  solicitud_id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string;
  estado_expedicion: string;
  /** Nulo mientras la expedicion sigue en curso (columna nullable en la BD). */
  completado_en: string | null;
  total_paradas: number;
  visitadas: number;
  titulo_plan: string;
}

/** Respuesta paginada de expediciones. */
export interface AdminGetExpedicionesResult {
  expediciones: AdminExpedicion[];
  totalCount: number;
}

/** Resultado genérico de una mutación administrativa. */
export interface AdminMutationResult {
  success: boolean;
  error?: string;
}
