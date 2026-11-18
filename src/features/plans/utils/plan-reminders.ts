/**
 * Reglas de tiempo de los avisos del recorrido.
 *
 * Aqui no se importa ningun modulo nativo a proposito: son funciones puras y
 * se pueden probar sin emulador ni permisos.
 */

/** Minutos de anticipacion con los que se avisa la llegada a una parada. */
export const STOP_REMINDER_MINUTES_BEFORE = 10;

/** Distancia en metros bajo la cual se considera que el usuario esta en la parada. */
export const NEARBY_STOP_RADIUS_METERS = 120;

const MINUTES_PER_DAY = 1440;
const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * Devuelve la proxima vez que el reloj marque `horaHHMM` a partir de `ahora`.
 * Si la hora ya paso hoy, devuelve la de manana. Devuelve null cuando el texto
 * no es una hora valida.
 */
export function nextTimeToday(horaHHMM: string, ahora: Date = new Date()): Date | null {
  const coincidencia = /^(\d{1,2}):(\d{2})$/.exec(horaHHMM.trim());
  if (!coincidencia) {
    return null;
  }

  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  if (horas > 23 || minutos > 59) {
    return null;
  }

  const objetivo = new Date(ahora.getTime());
  objetivo.setHours(horas, minutos, 0, 0);

  if (objetivo.getTime() <= ahora.getTime()) {
    objetivo.setTime(objetivo.getTime() + MINUTES_PER_DAY * MILLISECONDS_PER_MINUTE);
  }

  return objetivo;
}

/**
 * Momento en el que hay que mostrar el recordatorio de una parada: la hora de
 * llegada menos los minutos de anticipacion. Devuelve null si ese momento ya
 * paso, porque un aviso en el pasado no aporta nada.
 */
export function reminderDateFor(
  horaLlegada: string,
  ahora: Date = new Date(),
): Date | null {
  const llegada = nextTimeToday(horaLlegada, ahora);
  if (!llegada) {
    return null;
  }

  const recordatorio = new Date(
    llegada.getTime() - STOP_REMINDER_MINUTES_BEFORE * MILLISECONDS_PER_MINUTE,
  );

  return recordatorio.getTime() > ahora.getTime() ? recordatorio : null;
}

/**
 * Texto del aviso que aparece al acercarse a una parada. Redondea los metros
 * a la decena para no mostrar una precision que el GPS no tiene.
 */
export function formatNearbyStopMessage(nombre: string, metros: number): string {
  const decenas = Math.max(1, Math.round(metros / 10)) * 10;
  return `${nombre} te queda a ${decenas} m. Marcala cuando llegues.`;
}
