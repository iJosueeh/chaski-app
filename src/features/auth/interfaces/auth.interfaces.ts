export interface AuthRequest {
    email: string,
    password: string,
    nombre: string
}

export interface LoginRequest {
    email: string,
    password: string
}

/**
 * Rol asignado a un usuario de la aplicación (Serie AX).
 * Propiedad de Auth por ser parte del estado de sesión (`userRole`); admin lo
 * re-exporta desde `interfaces/admin.interface` para conservar su contrato.
 */
export type UserRole = 'USUARIO' | 'ADMIN';

/**
 * Estados posibles de la cuenta del usuario autenticado derivados del perfil.
 */
export type UserAccountStatus = 'activo' | 'suspendido' | 'sesion_ausente' | 'cargando' | 'error_red';

/**
 * Perfil básico del usuario autenticado obtenido de public.usuarios.
 */
export interface UserProfileRecord {
    id: string;
    nombre: string;
    rol: UserRole;
    estado: boolean;
    fecha_registro: string;
}