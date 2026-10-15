/**
 * Utilidades y formateadores para la pantalla de Plan Activo (Serie AX).
 */

/** Formatea de forma precisa y honesta el costo o gasto estimado de una parada */
export function formatStopCostLabel(
  costoEstimado: number,
  gastoMin?: number | null,
  gastoMax?: number | null
): string {
  const max = gastoMax ?? costoEstimado;
  if (costoEstimado === 0 && (!max || max === 0)) {
    return 'Acceso libre / Sin costo';
  }
  if (gastoMin != null && max != null && gastoMin > 0 && gastoMin !== max) {
    return `Gasto referencial: S/ ${gastoMin} — S/ ${max}`;
  }
  if (max > 0) {
    return `Gasto estimado: hasta S/ ${max}`;
  }
  return 'Gasto referencial no especificado';
}

/** Formatea la hora estimada de llegada proyectada por el motor */
export function formatStopArrivalLabel(horaLlegada: string): string {
  return `Llegada estimada: ${horaLlegada} hrs`;
}

/** Formatea la duración sugerida de permanencia en el lugar */
export function formatStopDurationLabel(duracionMin: number): string {
  return `Permanencia sugerida: ${duracionMin} min`;
}

/**
 * Explica al usuario el estado del botón Finalizar y los requisitos para completar el plan
 */
export function getFinalizarHelperText(visitadasCount: number, totalStops: number): string {
  if (visitadasCount === 0) {
    return 'El botón «Finalizar» se habilitará al marcar al menos una parada como visitada (toca el casillero [✓] de la parada).';
  }
  if (visitadasCount < totalStops) {
    const pendientes = totalStops - visitadasCount;
    return `Llevas ${visitadasCount} de ${totalStops} parada(s) registrada(s). Tienes ${pendientes} pendiente(s); puedes continuar o finalizar con tu avance actual.`;
  }
  return '¡Recorrido completado! Pulsa «FINALIZAR PLAN» para sellar tu expedición y registrarla en el historial.';
}

/**
 * Construye la URL de navegación externa para abrir la aplicación de mapas del dispositivo
 */
export function buildMapsNavigationUrl(
  lat: number,
  lng: number,
  nombre: string,
  platformOS: string = 'android'
): { nativeUrl: string; webFallbackUrl: string } {
  const label = encodeURIComponent(nombre);
  const webFallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  let nativeUrl = webFallbackUrl;
  if (platformOS === 'ios') {
    nativeUrl = `maps:0,0?q=${label}@${lat},${lng}`;
  } else if (platformOS === 'android') {
    nativeUrl = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
  }

  return { nativeUrl, webFallbackUrl };
}
