/**
 * Avisos locales del recorrido (Unidad 3).
 *
 * El modulo de notificaciones se carga de forma diferida por dos razones: la
 * app debe seguir usable si el dispositivo no las soporta, y las pruebas
 * unitarias corren en Node, donde no hay modulos nativos.
 */

import { formatNearbyStopMessage, reminderDateFor } from '../utils/plan-reminders';

type NotificationsModule = typeof import('expo-notifications');

let moduloNotificaciones: NotificationsModule | null = null;
let cargaIntentada = false;

const CHANNEL_ID = 'chaski-recordatorios';

async function getNotifications(): Promise<NotificationsModule | null> {
  if (cargaIntentada) {
    return moduloNotificaciones;
  }
  cargaIntentada = true;

  try {
    const modulo = await import('expo-notifications');
    modulo.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    moduloNotificaciones = modulo;
  } catch {
    moduloNotificaciones = null;
  }

  return moduloNotificaciones;
}

/**
 * Pide permiso de notificaciones la primera vez. Devuelve false cuando el
 * usuario lo niega o el dispositivo no soporta avisos.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const modulo = await getNotifications();
  if (!modulo) {
    return false;
  }

  try {
    const actual = await modulo.getPermissionsAsync();
    if (actual.granted) {
      return true;
    }

    const solicitado = await modulo.requestPermissionsAsync();
    return solicitado.granted;
  } catch {
    return false;
  }
}

async function prepararCanal(modulo: NotificationsModule): Promise<void> {
  try {
    await modulo.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios de recorrido',
      importance: modulo.AndroidImportance.DEFAULT,
    });
  } catch {
    // iOS no tiene canales: el fallo es esperado y no afecta al aviso.
  }
}

export interface StopReminderResult {
  /** Momento en el que quedara programado el aviso, o null si no se programo. */
  programadoPara: Date | null;
  /** Motivo legible cuando no se pudo programar. */
  motivo: string | null;
}

/**
 * Programa un aviso para la proxima parada, unos minutos antes de la hora de
 * llegada estimada. Reemplaza cualquier aviso anterior del plan para no dejar
 * notificaciones huerfanas.
 */
export async function scheduleStopReminder(
  nombreParada: string,
  horaLlegada: string,
  ahora: Date = new Date(),
): Promise<StopReminderResult> {
  const programadoPara = reminderDateFor(horaLlegada, ahora);
  if (!programadoPara) {
    return { programadoPara: null, motivo: 'La hora de llegada ya paso' };
  }

  const modulo = await getNotifications();
  if (!modulo) {
    return { programadoPara: null, motivo: 'Este dispositivo no soporta avisos' };
  }

  const habilitado = await ensureNotificationPermission();
  if (!habilitado) {
    return { programadoPara: null, motivo: 'Sin permiso de notificaciones' };
  }

  try {
    await prepararCanal(modulo);
    await modulo.cancelAllScheduledNotificationsAsync();
    await modulo.scheduleNotificationAsync({
      content: {
        title: 'Chaski',
        body: `${nombreParada} es tu proxima parada`,
      },
      trigger: {
        type: modulo.SchedulableTriggerInputTypes.DATE,
        date: programadoPara,
        channelId: CHANNEL_ID,
      },
    });
    return { programadoPara, motivo: null };
  } catch {
    return { programadoPara: null, motivo: 'No se pudo programar el aviso' };
  }
}

/**
 * Muestra el aviso de cercania en el momento. Se usa cuando el GPS detecta que
 * el usuario esta a menos de `NEARBY_STOP_RADIUS_METERS` de la parada.
 */
export async function notifyNearbyStop(nombre: string, metros: number): Promise<boolean> {
  const modulo = await getNotifications();
  if (!modulo) {
    return false;
  }

  const habilitado = await ensureNotificationPermission();
  if (!habilitado) {
    return false;
  }

  try {
    await prepararCanal(modulo);
    await modulo.scheduleNotificationAsync({
      content: {
        title: 'Estas cerca',
        body: formatNearbyStopMessage(nombre, metros),
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}

/** Cancela los avisos programados al completar, abandonar o cancelar el plan. */
export async function cancelPlanNotifications(): Promise<void> {
  const modulo = await getNotifications();
  if (!modulo) {
    return;
  }

  try {
    await modulo.cancelAllScheduledNotificationsAsync();
  } catch {
    // Si el sistema ya limpio la cola, no hay nada que hacer.
  }
}
