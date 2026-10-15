/**
 * API pública de la feature admin.
 *
 * Exports explícitos (nunca `export *`): consumir esta feature no debe
 * arrastrar pantallas, servicios ni hooks internos, y evita colisiones
 * silenciosas de nombres. El resto de módulos se importan por ruta directa
 * (p. ej. `@/features/admin/services/admin.service`).
 */
export { AdminDashboardScreen } from './screens/admin-dashboard';
