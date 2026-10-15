/**
 * Utilidades y formateadores para la pantalla de Plan Completado (Serie AX).
 */
import type { EstadoExpedicion } from '../context/plans-context';

/**
 * Formatea la duración acumulada del recorrido de forma natural.
 * Ejemplos:
 * - 72 min -> «1 h 12 min aprox.»
 * - 60 min -> «1 h aprox.»
 * - 45 min -> «45 min aprox.»
 * - 0 min o nulo -> «0 min aprox.»
 */
export function formatCompletadoDuration(minutos: number | null | undefined): string {
  if (!minutos || !Number.isFinite(minutos) || minutos <= 0) {
    return '0 min aprox.';
  }
  // Redondea minutos fraccionarios para nunca mostrar decimales en el boleto
  // («1 h 12.4 min» rompe la estética Serie AX y confunde al viajero).
  const totalRedondeado = Math.round(minutos);
  const horas = Math.floor(totalRedondeado / 60);
  const mins = totalRedondeado % 60;

  if (horas > 0 && mins > 0) {
    return `${horas} h ${mins} min aprox.`;
  }
  if (horas > 0) {
    return `${horas} h aprox.`;
  }
  return `${mins} min aprox.`;
}

/**
 * Pluraliza correctamente la etiqueta de paradas alcanzadas.
 * - 1 parada -> «1 parada»
 * - 2 paradas -> «2 paradas»
 */
export function formatCompletadoStopsLabel(count: number): string {
  if (count === 1) {
    return '1 parada';
  }
  return `${count} paradas`;
}

/**
 * Formatea el texto resumen de metadatos de la tarjeta de boleto.
 * Ejemplo: «2 paradas · 1 h 12 min aprox.»
 */
export function formatCompletadoTicketMeta(stopsCount: number, durationMinutes: number | null | undefined): string {
  const stops = formatCompletadoStopsLabel(stopsCount);
  const duration = formatCompletadoDuration(durationMinutes);
  return `${stops} · ${duration}`;
}

/**
 * Obtiene la duración real de la expedición a partir del registro del plan.
 *
 * Fuente principal: `GeneratedPlan.duracion_total_min` (permanencia en cada
 * parada + minutos de traslado, en minutos enteros calculados por el motor).
 *
 * Respaldo: si el total no está disponible (planes antiguos o registros
 * incompletos en AsyncStorage), se suman las duraciones de las paradas del
 * boleto para no mostrar «0 min» en una expedición que sí tuvo estaciones.
 */
export function getCompletadoDurationMinutes(entry: {
  duracion_total_min?: number | null;
  paradas?: readonly { duracion_min?: number | null }[];
}): number {
  const total = entry.duracion_total_min;
  if (typeof total === 'number' && Number.isFinite(total) && total > 0) {
    return total;
  }

  const sumaParadas = (entry.paradas ?? []).reduce((acumulado, parada) => {
    const duracion = parada.duracion_min;
    const valida = typeof duracion === 'number' && Number.isFinite(duracion) && duracion > 0;
    return acumulado + (valida ? duracion : 0);
  }, 0);

  return sumaParadas;
}

export interface CompletadoPresentation {
  kicker: string;
  titulo: string;
  subtitulo: string;
  ticketKicker: string;
  stampFolio: string;
  stampRoute: string;
  puedeCelebrar: boolean;
}

/**
 * Resuelve los textos, sello y títulos honestos para la pantalla de finalización.
 * Garantiza que nunca se muestre «¡Expedición cumplida!» si hay paradas pendientes o abandono.
 */
export function getCompletadoPresentation(
  estado: EstadoExpedicion | 'HISTORICO',
  tituloPlan: string,
  fechaFormateada: string,
  visitadasCount: number,
  totalParadas: number,
): CompletadoPresentation {
  if (estado === 'COMPLETADA') {
    return {
      kicker: 'BOLETO VALIDADO · SERIE AX',
      titulo: '¡EXPEDICIÓN CUMPLIDA!',
      subtitulo: `${tituloPlan} · ${fechaFormateada}`,
      ticketKicker: 'ESTACIONES LOGRADAS',
      stampFolio: 'BOLETO SELLADO · ARCHIVADO',
      stampRoute: 'EXPEDICIÓN SATISFACTORIA',
      puedeCelebrar: true,
    };
  }

  if (estado === 'PARCIAL') {
    return {
      kicker: 'BOLETO PARCIAL · SERIE AX',
      titulo: 'EXPEDICIÓN PARCIAL',
      subtitulo: `${tituloPlan} · ${visitadasCount} de ${totalParadas} paradas registradas`,
      ticketKicker: `ESTACIONES DEL ITINERARIO (${visitadasCount}/${totalParadas})`,
      stampFolio: 'BOLETO ARCHIVADO · PARCIAL',
      stampRoute: 'RECORRIDO PARCIAL CONCLUIDO',
      puedeCelebrar: false,
    };
  }

  if (estado === 'ABANDONADA') {
    return {
      kicker: 'RECORRIDO INTERRUMPIDO · SERIE AX',
      titulo: 'EXPEDICIÓN ABANDONADA',
      subtitulo: `${tituloPlan} · Recorrido interrumpido (${visitadasCount}/${totalParadas} paradas)`,
      ticketKicker: `ESTACIONES REGISTRADAS (${visitadasCount}/${totalParadas})`,
      stampFolio: 'BOLETO ARCHIVADO · INTERRUMPIDO',
      stampRoute: 'RECORRIDO ABANDONADO',
      puedeCelebrar: false,
    };
  }

  // HISTORICO / Legacy (no presupone que todas fueron visitadas)
  return {
    kicker: 'ARCHIVO HISTÓRICO · SERIE AX',
    titulo: 'EXPEDICIÓN ARCHIVADA',
    subtitulo: `${tituloPlan} · ${fechaFormateada}`,
    ticketKicker: 'ESTACIONES DEL ITINERARIO',
    stampFolio: 'BOLETO ARCHIVADO · HISTÓRICO',
    stampRoute: 'ARCHIVO PATRIMONIAL',
    puedeCelebrar: false,
  };
}

