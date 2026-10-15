/**
 * Utilidades puras de tiempo «HH:MM» compartidas (Serie AX).
 *
 * Conversión genérica minutos del día ↔ cadena «HH:MM». No contiene reglas
 * de negocio: cada feature conserva su semántica de intervalo (cruce de
 * medianoche, duración mínima, etc.) encima de estas funciones.
 *
 * Nota: `plan-engine/viability.ts` mantiene su propio parser (acepta
 * «HH:MM:SS» y lanza excepción) porque forma parte del motor de itinerarios
 * y su semántica difiere; no se unifica con esta capa.
 */

/** Minutos que contiene un día completo. */
export const MINUTES_PER_DAY = 1440;

/**
 * Convierte «HH:MM» a minutos del día (0–1439).
 * Devuelve null si la cadena no representa una hora válida
 * (formato, horas 0–23 y minutos 0–59).
 */
export function parseTimeToMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) {
    return null;
  }
  const partes = hhmm.split(':');
  if (partes.length !== 2) {
    return null;
  }
  const [h, m] = partes.map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) {
    return null;
  }
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

/**
 * Convierte minutos del día (0–1439) a «HH:MM», normalizando valores fuera
 * de rango con aritmética modular (p. ej. 1440 → «00:00», -60 → «23:00»).
 */
export function minutesToTime(minutosDelDia: number): string {
  const normalizado =
    ((Math.round(minutosDelDia) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(normalizado / 60);
  const m = normalizado % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
