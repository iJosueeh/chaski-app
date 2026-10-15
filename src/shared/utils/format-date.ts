/**
 * Formateador puro de fechas compartido (Serie AX).
 *
 * Unifica el formateo «es-PE» de fechas cortas de boleto (día 2 dígitos,
 * mes abreviado, año) que se repetía en el historial y en la pantalla de
 * expedición completada.
 */

/**
 * Formatea una fecha ISO a estilo peruano corto: «13 oct 2026».
 * Devuelve `fallback` cuando la cadena no representa una fecha válida.
 */
export function formatDateShort(isoDate: string | null | undefined, fallback = ''): string {
  if (!isoDate) {
    return fallback;
  }
  const fecha = new Date(isoDate);
  if (Number.isNaN(fecha.getTime())) {
    return fallback;
  }
  return fecha.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
