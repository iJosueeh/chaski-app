/**
 * Validaciones del panel de intendencia (Fase 1 · APF3).
 *
 * Se validan los mismos límites que impone la base de datos:
 * `usuarios_nombre_len_check` (2..60) y `usuarios_rol_check` (USUARIO|ADMIN).
 * Validar en el cliente primero evita un viaje de red para mostrar un error
 * que ya conocemos; la base de datos vuelve a validar (nunca se confía solo
 * en el cliente).
 */

import {
  ADMIN_NOMBRE_MAX_LENGTH,
  ADMIN_NOMBRE_MIN_LENGTH,
  type AdminUpdateUserInput,
  type UserRole,
} from '../interfaces/admin.interface';

const ROLES_VALIDOS: readonly UserRole[] = ['USUARIO', 'ADMIN'];

/** Devuelve el nombre normalizado (sin espacios sobrantes). */
export function normalizeUserName(nombre: string | null | undefined): string {
  return (nombre ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Valida una edición de usuario.
 * @returns mensaje de error legible, o `null` si es válida.
 */
export function validateAdminUserInput(input: AdminUpdateUserInput): string | null {
  if (!input.id || input.id.trim() === '') {
    return 'Identificador de usuario no válido.';
  }

  const nombre = normalizeUserName(input.nombre);
  if (nombre.length < ADMIN_NOMBRE_MIN_LENGTH) {
    return `El nombre debe tener al menos ${ADMIN_NOMBRE_MIN_LENGTH} caracteres.`;
  }
  if (nombre.length > ADMIN_NOMBRE_MAX_LENGTH) {
    return `El nombre no puede superar los ${ADMIN_NOMBRE_MAX_LENGTH} caracteres.`;
  }
  if (!ROLES_VALIDOS.includes(input.rol)) {
    return 'El rol debe ser USUARIO o ADMIN.';
  }
  if (typeof input.estado !== 'boolean') {
    return 'El estado de la cuenta debe ser activo o suspendido.';
  }

  return null;
}

/**
 * Detecta si el formulario cambió algo respecto al usuario original.
 * Evita llamadas innecesarias a la base de datos.
 */
export function hasUserChanges(
  original: { nombre: string; rol: UserRole; estado: boolean },
  draft: { nombre: string; rol: UserRole; estado: boolean },
): boolean {
  return (
    normalizeUserName(original.nombre) !== normalizeUserName(draft.nombre) ||
    original.rol !== draft.rol ||
    original.estado !== draft.estado
  );
}
