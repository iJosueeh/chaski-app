export function sanitizeAdminError(err: any): string {
  if (!err) return 'Error inesperado';
  const msg = err.message || String(err);

  if (msg.includes('AUTH_UNAUTHORIZED') || err.code === '42501') {
    return 'Acceso denegado: Se requieren privilegios de administrador.';
  }
  if (msg.includes('AUTH_REQUIRED') || err.code === '28000') {
    return 'Sesión no válida o expirada. Inicia sesión nuevamente.';
  }
  if (msg.includes('Invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (msg.includes('CANNOT_DEACTIVATE_SELF')) {
    return 'No puedes desactivar tu propia cuenta de administrador.';
  }
  if (msg.includes('LAST_ADMIN_PROTECTION')) {
    return 'Operación rechazada: No se puede desactivar al único administrador activo del sistema.';
  }
  if (msg.includes('USER_NOT_FOUND') || err.code === 'P0002') {
    return 'El usuario especificado no fue encontrado.';
  }
  if (msg.includes('PGRST202') || msg.includes('Could not find the function')) {
    return 'Las funciones administrativas de base de datos aún no han sido desplegadas en el servidor.';
  }
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) {
    return 'Error de conexión con el servidor. Verifica tu conexión a internet.';
  }

  return msg;
}
