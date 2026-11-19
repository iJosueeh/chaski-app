import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';

import {
  DOWNLOAD_CHANNEL_ID,
  ensureNotificationPermission,
  notifyDownloadCompleted,
  notifyDownloadStarted,
  openPdfFromUri,
  registerPdfNotificationListener,
  setupDownloadChannel,
} from '../services/admin-pdf-notification.service';

vi.mock('react-native', () => {
  const currentPlatform = {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  };
  return {
    Platform: currentPlatform,
  };
});

const {
  mockScheduleNotificationAsync,
  mockDismissNotificationAsync,
  mockSetNotificationChannelAsync,
  mockGetPermissionsAsync,
  mockRequestPermissionsAsync,
  mockAddNotificationResponseReceivedListener,
  mockShareAsync,
  mockFilePreview,
} = vi.hoisted(() => ({
  mockScheduleNotificationAsync: vi.fn(),
  mockDismissNotificationAsync: vi.fn(),
  mockSetNotificationChannelAsync: vi.fn(),
  mockGetPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  mockRequestPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  mockAddNotificationResponseReceivedListener: vi.fn(),
  mockShareAsync: vi.fn().mockResolvedValue(undefined),
  mockFilePreview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  dismissNotificationAsync: mockDismissNotificationAsync,
  addNotificationResponseReceivedListener: mockAddNotificationResponseReceivedListener,
  AndroidImportance: { HIGH: 4 },
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn().mockResolvedValue(true),
  shareAsync: mockShareAsync,
}));

vi.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    preview = mockFilePreview;
  }
  return {
    File: MockFile,
  };
});

describe('Admin PDF Notification Service (Serie AX)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
  });

  describe('setupDownloadChannel', () => {
    it('crea canal de notificaciones en Android con alta importancia', async () => {
      const originalOS = Platform.OS;
      (Platform as { OS: string }).OS = 'android';

      await setupDownloadChannel();

      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        DOWNLOAD_CHANNEL_ID,
        expect.objectContaining({
          name: 'Descargas de Reportes',
          importance: 4,
        }),
      );

      (Platform as { OS: string }).OS = originalOS;
    });
  });

  describe('ensureNotificationPermission', () => {
    it('retorna true si los permisos ya están otorgados', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });
      const granted = await ensureNotificationPermission();
      expect(granted).toBe(true);
    });

    it('solicita permisos si no están otorgados previamente', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ granted: false });
      mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: true });

      const granted = await ensureNotificationPermission();
      expect(granted).toBe(true);
      expect(mockRequestPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('Flujo de Descarga: Inicio y Finalización', () => {
    it('notifyDownloadStarted emite notificación de inicio', async () => {
      mockScheduleNotificationAsync.mockResolvedValueOnce('notif-123');

      const id = await notifyDownloadStarted('Reporte_2026.pdf');

      expect(id).toBe('notif-123');
      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Descargando reporte...',
            body: expect.stringContaining('Reporte_2026.pdf'),
          }),
        }),
      );
    });

    it('notifyDownloadCompleted descarta aviso de inicio y emite notificación de completado con acción', async () => {
      mockScheduleNotificationAsync.mockResolvedValueOnce('notif-456');

      const id = await notifyDownloadCompleted(
        'notif-123',
        'Reporte_2026.pdf',
        'file:///data/user/0/chaski/files/Reporte_2026.pdf',
      );

      expect(mockDismissNotificationAsync).toHaveBeenCalledWith('notif-123');
      expect(id).toBe('notif-456');
      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Descarga completada',
            body: expect.stringContaining('Toca para abrir'),
            data: expect.objectContaining({
              action: 'open_pdf',
              uri: 'file:///data/user/0/chaski/files/Reporte_2026.pdf',
            }),
          }),
        }),
      );
    });
  });

  describe('Apertura de PDF al pulsar notificación (openPdfFromUri)', () => {
    it('intenta abrir con File.preview primero', async () => {
      const opened = await openPdfFromUri('file:///data/reporte.pdf');
      expect(opened).toBe(true);
      expect(mockFilePreview).toHaveBeenCalledWith({ mimeType: 'application/pdf' });
    });

    it('si preview falla, recurre a Sharing.shareAsync', async () => {
      mockFilePreview.mockRejectedValueOnce(new Error('Preview unavailable'));

      const opened = await openPdfFromUri('file:///data/reporte.pdf');
      expect(opened).toBe(true);
      expect(mockShareAsync).toHaveBeenCalledWith(
        'file:///data/reporte.pdf',
        expect.objectContaining({ mimeType: 'application/pdf' }),
      );
    });
  });

  describe('registerPdfNotificationListener', () => {
    it('registra listener que procesa action open_pdf', async () => {
      let registeredCallback: ((resp: unknown) => void) | null = null;
      mockAddNotificationResponseReceivedListener.mockImplementationOnce((cb) => {
        registeredCallback = cb;
        return { remove: vi.fn() };
      });

      const cleanup = registerPdfNotificationListener();
      expect(typeof cleanup).toBe('function');

      // Esperar resolución de la promesa interna
      await Promise.resolve();

      if (registeredCallback) {
        (registeredCallback as (resp: unknown) => void)({
          notification: {
            request: {
              content: {
                data: {
                  action: 'open_pdf',
                  uri: 'file:///data/test.pdf',
                },
              },
            },
          },
        });
      }

      cleanup();
    });
  });
});
