/**
 * Utilidades y formateadores para la pantalla de Historial ("Mis Exploraciones") — Serie AX.
 */
import { formatDateShort } from '@/shared/utils/format-date';

import type { EstadoExpedicion } from '../context/plans-context';
import type {
  MovilidadSolicitud,
  TipoPuntoFinal,
} from '../interfaces/solicitudes-plan.interface';

/** Formatea el folio de archivo de manera estable */
export function formatFolioNumber(indexFromEnd: number, planId?: string): string {
  // Número secuencial de archivo (ej. N° 00001)
  const numPad = String(Math.max(1, indexFromEnd)).padStart(5, '0');
  if (planId && typeof planId === 'string') {
    // Si el id contiene caracteres alfanuméricos estables, genera sufijo
    const cleanId = planId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
    if (cleanId.length === 4) {
      return `FOLIO AX · N° ${numPad}-${cleanId}`;
    }
  }
  return `FOLIO AX · N° ${numPad}`;
}

/**
 * Formatea la fecha de compleción en formato peruano legible.
 * Delega en el formateador compartido `formatDateShort` (@/shared/utils/format-date).
 */
export function formatHistoryDate(isoDate: string): string {
  return formatDateShort(isoDate, 'Fecha no disponible');
}

/** Formatea la duración total de minutos a formato legible de horas y minutos */
export function formatTotalDuration(minutos: number): string {
  if (!minutos || minutos <= 0) {
    return 'Tiempo variable';
  }
  const horas = Math.floor(minutos / 60);
  const minsRestantes = minutos % 60;

  if (horas === 0) {
    return `${minsRestantes} min`;
  }
  if (minsRestantes === 0) {
    return `${horas}h`;
  }
  return `${horas}h ${minsRestantes}m`;
}

/** Formatea honestamente el costo total referencial */
export function formatHistoryCost(costoTotal: number): string {
  if (costoTotal == null || costoTotal === 0) {
    return 'Acceso libre';
  }
  return `S/ ${costoTotal} aprox.`;
}

/** Formatea la etiqueta de cantidad de paradas */
export function formatHistoryStopsLabel(count: number): string {
  if (count === 1) {
    return '1 parada lograda';
  }
  return `${count} paradas logradas`;
}

/** Formatea el contador de boletos validados en el encabezado */
export function formatValidatedCountLabel(count: number): string {
  if (count === 1) {
    return '1 boleto validado';
  }
  return `${count} boletos validados`;
}

/**
 * Resuelve el estado de una expedición según su progreso real.
 * Si es un registro histórico antiguo sin `estado_expedicion` ni `paradas_visitadas`,
 * retorna 'HISTORICO' sin suponer que todas sus paradas fueron visitadas.
 */
export function resolveEstadoExpedicion(entry: {
  estado_expedicion?: EstadoExpedicion | 'HISTORICO';
  paradas_visitadas?: number[];
  paradas?: readonly unknown[];
}): EstadoExpedicion | 'HISTORICO' {
  if (entry.estado_expedicion) {
    return entry.estado_expedicion;
  }
  // Si no cuenta con el campo paradas_visitadas, es un registro legacy
  if (!Array.isArray(entry.paradas_visitadas)) {
    return 'HISTORICO';
  }
  const total = entry.paradas?.length ?? 0;
  const visitadasCount = entry.paradas_visitadas.length;
  if (visitadasCount === 0) {
    return 'ABANDONADA';
  }
  if (total > 0 && visitadasCount >= total) {
    return 'COMPLETADA';
  }
  return 'PARCIAL';
}

/**
 * Obtiene de forma segura el arreglo de paradas visitadas.
 * En registros históricos antiguos retorna [] (no supone visitadas).
 */
export function getParadasVisitadas(entry: { paradas_visitadas?: number[] } | Record<string, any>): number[] {
  if (entry && 'paradas_visitadas' in entry && Array.isArray((entry as any).paradas_visitadas)) {
    return (entry as any).paradas_visitadas;
  }
  return [];
}

/**
 * Formatea el texto de estado y avance para la tarjeta del boleto.
 */
export function formatHistoryStatusLabel(
  estado: EstadoExpedicion | 'HISTORICO',
  visitadasCount: number,
  totalParadas: number,
): string {
  switch (estado) {
    case 'COMPLETADA':
      return `${totalParadas} ${totalParadas === 1 ? 'parada alcanzada' : 'paradas alcanzadas'} (100%)`;
    case 'PARCIAL':
      return `${visitadasCount} de ${totalParadas} ${totalParadas === 1 ? 'parada alcanzada' : 'paradas alcanzadas'}`;
    case 'ABANDONADA':
      return `Recorrido interrumpido (${visitadasCount} de ${totalParadas} paradas)`;
    case 'HISTORICO':
    default:
      return `${totalParadas} ${totalParadas === 1 ? 'parada registrada' : 'paradas registradas'}`;
  }
}

function formatHoraLocal(isoDate: string | null | undefined): string {
  if (!isoDate) return '--:--';
  const fecha = new Date(isoDate);
  if (Number.isNaN(fecha.getTime())) return '--:--';
  const hh = String(fecha.getHours()).padStart(2, '0');
  const mm = String(fecha.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatSolicitudHorario(inicioIso: string, finIso: string): string {
  return `${formatHoraLocal(inicioIso)} → ${formatHoraLocal(finIso)}`;
}

export function formatSolicitudDuracion(inicioIso: string, finIso: string): string {
  const inicio = new Date(inicioIso).getTime();
  const fin = new Date(finIso).getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fin)) {
    return 'Tiempo variable';
  }
  return formatTotalDuration(Math.round((fin - inicio) / 60000));
}

export function formatPresupuestoSolicitud(
  gastoMin: number | null,
  gastoMax: number | null,
): string {
  if (gastoMax === null || gastoMax === undefined) {
    return gastoMin ? `Desde S/ ${gastoMin}` : 'Sin límite';
  }
  if (!gastoMin) return `Hasta S/ ${gastoMax}`;
  if (gastoMin === gastoMax) return `S/ ${gastoMax}`;
  return `S/ ${gastoMin} – S/ ${gastoMax}`;
}

export function formatMovilidadSolicitud(movilidad: MovilidadSolicitud): string {
  switch (movilidad) {
    case 'TRANSPORTE_PUBLICO':
      return 'Transporte público';
    case 'AUTO':
      return 'Taxi / aplicativo';
    case 'CAMINANDO':
    default:
      return 'Caminando';
  }
}

export function formatTipoPuntoFinal(
  tipo: TipoPuntoFinal,
  finalDescripcion: string | null,
): string {
  switch (tipo) {
    case 'ULTIMA_PARADA':
      return 'Última parada';
    case 'OTRA_UBICACION':
      return finalDescripcion ?? 'Otra ubicación';
    case 'REGRESAR_INICIO':
    default:
      return 'Regresar al inicio';
  }
}

export function formatSolicitudTitulo(inicioDescripcion: string | null): string {
  return inicioDescripcion ? `Expedición desde ${inicioDescripcion}` : 'Solicitud de ruta';
}

