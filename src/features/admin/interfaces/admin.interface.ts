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
