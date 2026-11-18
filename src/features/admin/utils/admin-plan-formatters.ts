/**
 * Formateadores de la gestión de planes y expediciones (panel de administración).
 *
 * Viven fuera de la pantalla para poder probarlos sin renderizar React y para
 * que cualquier otra vista administrativa los reutilice en lugar de copiarlos.
 */

/** Etiquetas legibles de la movilidad elegida por el usuario en el wizard. */
const MOBILITY_LABELS: Record<string, string> = {
  CAMINANDO: 'Caminando',
  TRANSPORTE_PUBLICO: 'Transporte público',
  AUTO: 'Aplicativo / auto',
};

const MISSING_DATE_LABEL = 'Sin fecha';

/**
 * Etiqueta legible de una movilidad. Si la base trae un modo que la interfaz
 * todavía no conoce, devuelve el valor crudo en lugar de una cadena vacía
 * para que el administrador vea que existe un caso nuevo.
 */
export function formatMobilityLabel(movilidad: string | null | undefined): string {
  if (!movilidad) {
    return '';
  }
  return MOBILITY_LABELS[movilidad] ?? movilidad;
}

/**
 * Formatea una fecha ISO como «13 oct, 16:00» en la zona del dispositivo.
 * Devuelve `MISSING_DATE_LABEL` cuando el valor es nulo o no es una fecha válida.
 */
export function formatPlanDateTime(iso: string | null): string {
  if (!iso) {
    return MISSING_DATE_LABEL;
  }
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return MISSING_DATE_LABEL;
  }
  return fecha.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
