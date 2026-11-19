/**
 * Servicio de Notificaciones para Descarga y Apertura de Reportes PDF (Serie AX).
 *
 * Emite avisos locales en el sistema operativo:
 * 1. "Descargando reporte..." al iniciar la compilación.
 * 2. "Descarga completada" con acción interactiva para abrir el PDF al tocar la notificación.
 */

import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type NotificationsModule = typeof import('expo-notifications');

let moduloNotificaciones: NotificationsModule | null = null;
let cargaIntentada = false;

export const DOWNLOAD_CHANNEL_ID = 'chaski-descargas';

/**
 * Obtiene el módulo nativo de notificaciones de forma segura (tolerante a entornos web/pruebas).
 */
export async function getNotificationsModule(): Promise<NotificationsModule | null> {
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
        shouldPlaySound: true,
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
 * Prepara el canal de notificaciones en Android para avisos de descarga de alta prioridad.
 */
export async function setupDownloadChannel(): Promise<void> {
  const notifications = await getNotificationsModule();
  if (!notifications || Platform.OS !== 'android') {
    return;
  }

  try {
    await notifications.setNotificationChannelAsync(DOWNLOAD_CHANNEL_ID, {
      name: 'Descargas de Reportes',
      importance: notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#9C3E1B',
    });
  } catch {
    // Si la plataforma no soporta canales, continúa sin fallar
  }
}

/**
 * Verifica o solicita permisos para emitir notificaciones locales.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const notifications = await getNotificationsModule();
  if (!notifications) {
    return false;
  }

  try {
    const current = await notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    const requested = await notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/**
 * Notifica que la descarga y compilación del reporte PDF ha comenzado.
 */
export async function notifyDownloadStarted(fileName: string): Promise<string | null> {
  const notifications = await getNotificationsModule();
  if (!notifications) {
    return null;
  }

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    return null;
  }

  await setupDownloadChannel();

  try {
    const id = await notifications.scheduleNotificationAsync({
      content: {
        title: 'Descargando reporte...',
        body: `Compilando y guardando ${fileName}`,
        channelId: DOWNLOAD_CHANNEL_ID,
        data: { type: 'download_progress', fileName },
      },
      trigger: null,
    });
    return id;
  } catch {
    return null;
  }
}

/**
 * Notifica que la descarga se completó satisfactoriamente y adjunta la URI para abrir al pulsar.
 */
export async function notifyDownloadCompleted(
  startedNotificationId: string | null,
  fileName: string,
  uri: string,
): Promise<string | null> {
  const notifications = await getNotificationsModule();
  if (!notifications) {
    return null;
  }

  if (startedNotificationId) {
    try {
      await notifications.dismissNotificationAsync(startedNotificationId);
    } catch {
      // Ignorar fallo al descartar notificación anterior
    }
  }

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    return null;
  }

  await setupDownloadChannel();

  try {
    const id = await notifications.scheduleNotificationAsync({
      content: {
        title: 'Descarga completada',
        body: `${fileName} listo. Toca para abrir.`,
        channelId: DOWNLOAD_CHANNEL_ID,
        sound: 'default',
        data: {
          action: 'open_pdf',
          uri,
          fileName,
        },
      },
      trigger: null,
    });
    return id;
  } catch {
    return null;
  }
}

/**
 * Abre el archivo PDF utilizando visor nativo o diálogo del sistema.
 */
export async function openPdfFromUri(uri: string): Promise<boolean> {
  if (!uri) return false;

  try {
    const file = new File(uri);
    if (typeof file.preview === 'function') {
      await file.preview({ mimeType: 'application/pdf' });
      return true;
    }
  } catch {
    // Si preview falla, intentar con diálogo nativo de compartir/abrir
  }

  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Abrir Reporte PDF',
      });
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Registra un listener global que intercepta el toque de la notificación y abre el documento.
 */
export function registerPdfNotificationListener(): () => void {
  let subscription: { remove: () => void } | null = null;

  void (async () => {
    const notifications = await getNotificationsModule();
    if (!notifications) return;

    subscription = notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data && data.action === 'open_pdf' && typeof data.uri === 'string') {
        void openPdfFromUri(data.uri);
      }
    });
  })();

  return () => {
    if (subscription) {
      subscription.remove();
    }
  };
}
