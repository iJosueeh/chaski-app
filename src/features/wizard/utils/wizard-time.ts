/**
 * Reglas de tiempo del Wizard — Paso 2 de 5 «Tiempo disponible» (Serie AX).
 *
 * Única fuente de cálculo del intervalo: los presets (chips), la validación,
 * el botón CONTINUAR y los datos enviados al contexto usan estas funciones,
 * de modo que la UI y el envío no pueden divergir en el criterio.
 *
 * Regla de medianoche (misma semántica que ya aplica `solicitudes-plan.service`,
 * que interpreta `horaFin <= horaInicio` como día siguiente): cuando la hora
 * límite es anterior a la hora de inicio, el intervalo se toma del día
 * siguiente. Con esta regla la duración resultante queda siempre en el rango
 * (0, 1440) minutos, sin introducir límites nuevos.
 *
 * Límites existentes respetados:
 * - Mínimo: 1 minuto («misma hora» = 0 min = inválido, CTA deshabilitado).
 * - Máximo natural: menos de 24 h (interpretación de un solo día siguiente).
 */

import {
  MINUTES_PER_DAY,
  minutesToTime,
  parseTimeToMinutes,
} from '@/shared/utils/time';

/** Minutos que contiene un día completo. */
export const MINUTOS_POR_DIA = MINUTES_PER_DAY;

/**
 * Convierte «HH:MM» a minutos del día (0–1439).
 * Devuelve null si la cadena no representa una hora válida.
 * (Delega al parser compartido de `@/shared/utils/time`; semántica intacta.)
 */
export function parseHoraAMinutos(hhmm: string | null | undefined): number | null {
  return parseTimeToMinutes(hhmm);
}

/** Minutos del día (0–1439) de una fecha, ignorando año/mes/día. */
export function minutoDelDia(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes();
}

/**
 * Convierte minutos del día (0–1439) a «HH:MM», normalizando valores fuera
 * de rango con aritmética modular (p. ej. 23:52 + 15 min → 00:07).
 * (Delega al formateador compartido de `@/shared/utils/time`.)
 */
export function minutosAHora(minutosDelDia: number): string {
  return minutesToTime(minutosDelDia);
}

/**
 * Duración del intervalo en minutos, interpretando la hora límite como el
 * día siguiente cuando es anterior a la hora de inicio (cruce de medianoche).
 *
 * - 09:00 → 13:00 = 240
 * - 22:00 → 02:00 = 240 (día siguiente)
 * - 10:00 → 10:00 = 0 (misma hora: sin duración)
 */
export function duracionEntreHoras(inicioMin: number, finMin: number): number {
  return (finMin - inicioMin + MINUTOS_POR_DIA) % MINUTOS_POR_DIA;
}

/** true si la hora límite cae al día siguiente respecto a la hora de inicio. */
export function cruzaMedianoche(inicioMin: number, finMin: number): boolean {
  return finMin < inicioMin;
}

/** El intervalo es válido si dura al menos 1 minuto y menos de 24 h. */
export function esIntervaloValido(duracionMin: number): boolean {
  return (
    Number.isFinite(duracionMin) && duracionMin > 0 && duracionMin < MINUTOS_POR_DIA
  );
}
