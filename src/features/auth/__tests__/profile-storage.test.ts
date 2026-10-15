import { describe, expect, it, vi, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import {
  extractAvatarPath,
  replaceUserAvatar,
  removeUserAvatar,
  processPendingAvatarCleanups,
  enqueuePendingAvatarCleanup,
  getPendingCleanups,
  detectImageFormat,
  base64ToUint8Array,
} from '../services/profile-storage.service';

vi.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: vi.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
  };
});

vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      storage: {
        from: vi.fn(),
      },
      auth: {
        updateUser: vi.fn(),
        getUser: vi.fn(),
      },
    },
  };
});

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

describe('Profile Storage Service - Fase 2', () => {
  const userId = 'user-abc-123';
  const mockStorageFrom = supabase.storage.from as unknown as ReturnType<typeof vi.fn>;
  const mockUpdateUser = supabase.auth.updateUser as unknown as ReturnType<typeof vi.fn>;
  const mockGetUser = supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>;

  let mockUpload: ReturnType<typeof vi.fn>;
  let mockRemove: ReturnType<typeof vi.fn>;
  let mockGetPublicUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();

    mockUpload = vi.fn();
    mockRemove = vi.fn();
    mockGetPublicUrl = vi.fn();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    mockStorageFrom.mockReturnValue({
      upload: mockUpload,
      remove: mockRemove,
      getPublicUrl: mockGetPublicUrl,
    });
  });

  describe('extractAvatarPath', () => {
    it('extrae correctamente la ruta relativa segura perteneciente al usuario', () => {
      const publicUrl = `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_12345.jpg`;
      const path = extractAvatarPath(publicUrl, userId);
      expect(path).toBe(`${userId}/avatar_12345.jpg`);
    });

    it('elimina los query params de cache-busting', () => {
      const publicUrl = `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_12345.jpg?t=987654321`;
      const path = extractAvatarPath(publicUrl, userId);
      expect(path).toBe(`${userId}/avatar_12345.jpg`);
    });

    it('retorna null si la URL pertenece a otro usuario para evitar borrados no autorizados', () => {
      const attackerUrl = `https://project.supabase.co/storage/v1/object/public/avatars/other-user-999/avatar_evil.jpg`;
      const path = extractAvatarPath(attackerUrl, userId);
      expect(path).toBeNull();
    });

    it('retorna null si la ruta contiene directory traversal (..)', () => {
      const maliciousUrl = `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/../other-user/avatar.jpg`;
      const path = extractAvatarPath(maliciousUrl, userId);
      expect(path).toBeNull();
    });

    it('retorna null para valores nulos o vacíos', () => {
      expect(extractAvatarPath(null, userId)).toBeNull();
      expect(extractAvatarPath(undefined, userId)).toBeNull();
      expect(extractAvatarPath('', userId)).toBeNull();
    });
  });

  describe('detectImageFormat', () => {
    it('detecta correctamente firmas JPEG válidas', () => {
      const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(detectImageFormat(bytes)).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    });

    it('detecta correctamente firmas PNG válidas', () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]);
      expect(detectImageFormat(bytes)).toEqual({ mime: 'image/png', ext: 'png' });
    });

    it('detecta correctamente firmas WebP válidas', () => {
      const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
      expect(detectImageFormat(bytes)).toEqual({ mime: 'image/webp', ext: 'webp' });
    });

    it('rechaza archivos corruptos que no coinciden con ninguna firma válida', () => {
      const corrupt14Bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
      expect(detectImageFormat(corrupt14Bytes)).toBeNull();
    });

    it('rechaza buffers menores a 12 bytes', () => {
      expect(detectImageFormat(new Uint8Array(5))).toBeNull();
      expect(detectImageFormat(new Uint8Array(0))).toBeNull();
    });
  });

  describe('base64ToUint8Array', () => {
    it('convierte cadenas base64 a Uint8Array preservando los bytes exactos', () => {
      const bytes = base64ToUint8Array('SGVsbG9Xb3JsZCE='); // "HelloWorld!"
      expect(bytes.byteLength).toBe(11);
    });

    it('limpia encabezados data:image/...;base64, si están presentes', () => {
      const bytes = base64ToUint8Array('data:image/jpeg;base64,SGVsbG9Xb3JsZCE=');
      expect(bytes.byteLength).toBe(11);
    });
  });

  describe('replaceUserAvatar', () => {
    const createValidJpegBytes = (size = 1024) => {
      const bytes = new Uint8Array(size);
      bytes[0] = 0xFF;
      bytes[1] = 0xD8;
      bytes[2] = 0xFF;
      bytes[3] = 0xE0;
      return bytes;
    };

    const createValidPngBytes = (size = 1024) => {
      const bytes = new Uint8Array(size);
      bytes[0] = 0x89;
      bytes[1] = 0x50;
      bytes[2] = 0x4E;
      bytes[3] = 0x47;
      bytes[4] = 0x0D;
      bytes[5] = 0x0A;
      bytes[6] = 0x1A;
      bytes[7] = 0x0A;
      return bytes;
    };

    const createValidWebpBytes = (size = 1024) => {
      const bytes = new Uint8Array(size);
      bytes[0] = 0x52; // R
      bytes[1] = 0x49; // I
      bytes[2] = 0x46; // F
      bytes[3] = 0x46; // F
      bytes[8] = 0x57; // W
      bytes[9] = 0x45; // E
      bytes[10] = 0x42; // B
      bytes[11] = 0x50; // P
      return bytes;
    };

    it('rechaza archivos vacíos (0 bytes)', async () => {
      const emptyBuffer = new ArrayBuffer(0);
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(emptyBuffer) }),
      });

      const res = await replaceUserAvatar({
        userId,
        localUri: 'file:///path/to/empty.jpg',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('está vacío');
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('rechaza archivos demasiado pequeños o corruptos de 14 bytes', async () => {
      const corrupt14 = new ArrayBuffer(14);
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(corrupt14) }),
      });

      const res = await replaceUserAvatar({
        userId,
        localUri: 'file:///path/to/corrupt14.jpg',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('demasiado pequeño o está corrupto');
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('rechaza archivos sin firma binaria válida (magic bytes)', async () => {
      const fakeText = new Uint8Array(200); // 200 bytes de ceros
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(fakeText.buffer) }),
      });

      const res = await replaceUserAvatar({
        userId,
        localUri: 'file:///path/to/text.jpg',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('no es una imagen válida');
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('maneja errores de lectura del archivo local amigablemente', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Archivo no encontrado en almacenamiento local'));

      const res = await replaceUserAvatar({
        userId,
        localUri: 'file:///path/to/missing.jpg',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Error al leer el archivo de imagen');
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('rechaza archivos que exceden los 2 MB', async () => {
      // 2 MB + 1 byte
      const largeSize = 2 * 1024 * 1024 + 1;
      const largeBytes = createValidJpegBytes(largeSize);
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(largeBytes.buffer) }),
      });

      const res = await replaceUserAvatar({
        userId,
        localUri: 'file:///path/to/large.jpg',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('La fotografía no debe superar los 2 MB');
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('sube avatar JPEG con extensión .jpg y contentType image/jpeg', async () => {
      const validJpeg = createValidJpegBytes(2048);
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(validJpeg.buffer) }),
      });

      mockUpload.mockResolvedValueOnce({ error: null });
      mockGetPublicUrl.mockReturnValueOnce({
        data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_111.jpg` },
      });

      const updatedUser = {
        id: userId,
        email: 'explorador@chaski.pe',
        user_metadata: {
          nombre: 'Chaski Explorador',
          avatar_url: `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_111.jpg?t=123`,
        },
      };
      mockUpdateUser.mockResolvedValueOnce({ data: { user: updatedUser }, error: null });
      mockRemove.mockResolvedValueOnce({ error: null });

      const oldAvatarUrl = `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_old.jpg`;

      const res = await replaceUserAvatar({
        userId,
        localUri: 'file:///path/to/valid.jpg',
        currentAvatarUrl: oldAvatarUrl,
      });

      expect(res.success).toBe(true);
      expect(res.avatarUrl).toContain(`avatars/${userId}/avatar_`);
      expect(res.user).toEqual(updatedUser);

      // Verificamos subida al bucket con contentType y extensión correctos
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^${userId}/avatar_\\d+\\.jpg$`)),
        validJpeg,
        expect.objectContaining({ contentType: 'image/jpeg', upsert: true })
      );

      // Verificamos actualización en Supabase Auth
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: {
          avatar_url: expect.stringContaining(`avatars/${userId}/avatar_`),
        },
      });

      // Verificamos eliminación del avatar anterior
      expect(mockRemove).toHaveBeenCalledWith([`${userId}/avatar_old.jpg`]);
    });

    it('sube avatar PNG con extensión .png y contentType image/png', async () => {
      const validPng = createValidPngBytes(2048);
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(validPng.buffer) }),
      });

      mockUpload.mockResolvedValueOnce({ error: null });
      mockGetPublicUrl.mockReturnValueOnce({
        data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_222.png` },
      });

      const updatedUser = {
        id: userId,
        user_metadata: {
          avatar_url: `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_222.png?t=123`,
        },
      };
      mockUpdateUser.mockResolvedValueOnce({ data: { user: updatedUser }, error: null });

      const res = await replaceUserAvatar({
        userId,
        localUri: 'file:///path/to/valid.png',
      });

      expect(res.success).toBe(true);
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^${userId}/avatar_\\d+\\.png$`)),
        validPng,
        expect.objectContaining({ contentType: 'image/png', upsert: true })
      );
    });

    it('sube avatar WebP con extensión .webp y contentType image/webp', async () => {
      const validWebp = createValidWebpBytes(2048);
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(validWebp.buffer) }),
      });

      mockUpload.mockResolvedValueOnce({ error: null });
      mockGetPublicUrl.mockReturnValueOnce({
        data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_333.webp` },
      });

      const updatedUser = {
        id: userId,
        user_metadata: {
          avatar_url: `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_333.webp?t=123`,
        },
      };
      mockUpdateUser.mockResolvedValueOnce({ data: { user: updatedUser }, error: null });

      const res = await replaceUserAvatar({
        userId,
        localUri: 'file:///path/to/valid.webp',
      });

      expect(res.success).toBe(true);
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^${userId}/avatar_\\d+\\.webp$`)),
        validWebp,
        expect.objectContaining({ contentType: 'image/webp', upsert: true })
      );
    });

    it('admite base64 directo sin invocar fetch de archivo local', async () => {
      const validJpeg = createValidJpegBytes(150);
      // Codificar a base64
      let binaryStr = '';
      for (let i = 0; i < validJpeg.length; i++) {
        binaryStr += String.fromCharCode(validJpeg[i]);
      }
      const b64 = btoa(binaryStr);

      mockUpload.mockResolvedValueOnce({ error: null });
      mockGetPublicUrl.mockReturnValueOnce({
        data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_b64.jpg` },
      });
      mockUpdateUser.mockResolvedValueOnce({
        data: { user: { id: userId, user_metadata: { avatar_url: '...' } } },
        error: null,
      });

      const res = await replaceUserAvatar({
        userId,
        localUri: 'file:///ignored.jpg',
        base64: b64,
      });

      expect(res.success).toBe(true);
      // Fetch no debió llamarse porque se suministró base64
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^${userId}/avatar_\\d+\\.jpg$`)),
        validJpeg,
        expect.objectContaining({ contentType: 'image/jpeg' })
      );
    });

    it('hace rollback del archivo nuevo si falla la actualización en Supabase Auth', async () => {
      const validJpeg = createValidJpegBytes(1024);
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(validJpeg.buffer) }),
      });

      mockUpload.mockResolvedValueOnce({ error: null });
      mockGetPublicUrl.mockReturnValueOnce({
        data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_failed.jpg` },
      });

      mockUpdateUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Database connection error' },
      });
      mockRemove.mockResolvedValueOnce({ error: null });

      const oldAvatarUrl = `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_old.jpg`;

      const res = await replaceUserAvatar({
        userId,
        localUri: 'file:///path/to/valid.jpg',
        currentAvatarUrl: oldAvatarUrl,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Database connection error');

      // Se debió remover el archivo recién subido (rollback)
      expect(mockRemove).toHaveBeenCalledWith([expect.stringMatching(new RegExp(`^${userId}/avatar_\\d+\\.jpg$`))]);
      // Y NO se debió borrar el avatar anterior
      expect(mockRemove).not.toHaveBeenCalledWith([`${userId}/avatar_old.jpg`]);
    });

    it('encola el archivo recién subido si falla el rollback en Storage al fallar Auth', async () => {
      const validJpeg = createValidJpegBytes(1024);
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(validJpeg.buffer) }),
      });

      mockUpload.mockResolvedValueOnce({ error: null });
      mockGetPublicUrl.mockReturnValueOnce({
        data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_fail_rollback.jpg` },
      });

      // Auth falla
      mockUpdateUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Database connection error' },
      });
      // El rollback de Storage también falla
      mockRemove.mockResolvedValueOnce({
        error: { message: 'Storage timeout on rollback' },
      });

      const res = await replaceUserAvatar({
        userId,
        localUri: 'file:///path/to/valid.jpg',
      });

      expect(res.success).toBe(false);
      // El archivo huérfano debió encolarse en la cola de limpieza
      const pending = await getPendingCleanups();
      expect(pending).toHaveLength(1);
      expect(pending[0].path).toMatch(new RegExp(`^${userId}/avatar_\\d+\\.jpg$`));
      expect(pending[0].userId).toBe(userId);
    });

    it('encola en AsyncStorage si falla la eliminación del avatar anterior', async () => {
      const validJpeg = createValidJpegBytes(1024);
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(validJpeg.buffer) }),
      });

      mockUpload.mockResolvedValueOnce({ error: null });
      mockGetPublicUrl.mockReturnValueOnce({
        data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_success.jpg` },
      });

      const updatedUser = {
        id: userId,
        user_metadata: {
          avatar_url: `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_success.jpg?t=123`,
        },
      };
      mockUpdateUser.mockResolvedValueOnce({ data: { user: updatedUser }, error: null });

      // Error en el borrado del viejo
      mockRemove.mockResolvedValueOnce({ error: { message: 'Network timeout during deletion' } });

      const oldAvatarUrl = `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_old.jpg`;

      const res = await replaceUserAvatar({
        userId,
        localUri: 'file:///path/to/valid.jpg',
        currentAvatarUrl: oldAvatarUrl,
      });

      // La operación es exitosa para el usuario porque el nuevo avatar ya es vigente
      expect(res.success).toBe(true);

      // Verificamos que se encoló la tarea de limpieza pendiente
      const pending = await getPendingCleanups();
      expect(pending).toHaveLength(1);
      expect(pending[0].path).toBe(`${userId}/avatar_old.jpg`);
      expect(pending[0].userId).toBe(userId);
    });

    it('previene operaciones concurrentes sobre el mismo usuario', async () => {
      const validJpeg = createValidJpegBytes(1024);
      mockFetch.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve({
          blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(validJpeg.buffer) }),
        }), 50);
      }));

      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_1.jpg` },
      });
      mockUpdateUser.mockResolvedValue({
        data: { user: { id: userId, user_metadata: {} } },
        error: null,
      });

      const p1 = replaceUserAvatar({ userId, localUri: 'file:///p1.jpg' });
      const p2 = replaceUserAvatar({ userId, localUri: 'file:///p2.jpg' });

      const [res1, res2] = await Promise.all([p1, p2]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('Ya hay una actualización de avatar en curso');
    });
  });

  describe('removeUserAvatar', () => {
    it('elimina avatar de storage y limpia avatar_url en Supabase Auth', async () => {
      const activeAvatar = `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_to_delete.jpg`;
      const updatedUser = {
        id: userId,
        user_metadata: {
          avatar_url: null,
        },
      };
      mockUpdateUser.mockResolvedValueOnce({ data: { user: updatedUser }, error: null });
      mockRemove.mockResolvedValueOnce({ error: null });

      const res = await removeUserAvatar({
        userId,
        currentAvatarUrl: activeAvatar,
      });

      expect(res.success).toBe(true);
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: { avatar_url: null },
      });
      expect(mockRemove).toHaveBeenCalledWith([`${userId}/avatar_to_delete.jpg`]);
    });

    it('encola la limpieza si falla el borrado físico al remover avatar', async () => {
      const activeAvatar = `https://project.supabase.co/storage/v1/object/public/avatars/${userId}/avatar_orphan.jpg`;
      const updatedUser = {
        id: userId,
        user_metadata: {
          avatar_url: null,
        },
      };
      mockUpdateUser.mockResolvedValueOnce({ data: { user: updatedUser }, error: null });
      mockRemove.mockResolvedValueOnce({ error: { message: 'Storage error' } });

      const res = await removeUserAvatar({
        userId,
        currentAvatarUrl: activeAvatar,
      });

      expect(res.success).toBe(true);
      const pending = await getPendingCleanups();
      expect(pending).toHaveLength(1);
      expect(pending[0].path).toBe(`${userId}/avatar_orphan.jpg`);
    });
  });

  describe('processPendingAvatarCleanups', () => {
    it('reintenta eliminar archivos en cola y remueve los exitosos', async () => {
      await enqueuePendingAvatarCleanup(userId, `${userId}/avatar_pending1.jpg`);
      await enqueuePendingAvatarCleanup(userId, `${userId}/avatar_pending2.jpg`);

      mockRemove.mockResolvedValue({ error: null });

      const processedCount = await processPendingAvatarCleanups(userId);
      expect(processedCount).toBe(2);
      expect(mockRemove).toHaveBeenCalledWith([`${userId}/avatar_pending1.jpg`]);
      expect(mockRemove).toHaveBeenCalledWith([`${userId}/avatar_pending2.jpg`]);

      const remaining = await getPendingCleanups();
      expect(remaining).toHaveLength(0);
    });

    it('NUNCA elimina el avatar actualmente vigente en Supabase Auth y lo descarta de la cola', async () => {
      const activeFileName = `${userId}/avatar_active_now.jpg`;
      const orphanFileName = `${userId}/avatar_old_orphan.jpg`;

      // Simular que en Auth el avatar activo es avatar_active_now.jpg
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: userId,
            user_metadata: {
              avatar_url: `https://project.supabase.co/storage/v1/object/public/avatars/${activeFileName}?t=999`,
            },
          },
        },
        error: null,
      });

      // Encolamos ambos (uno es el activo por error o concurrencia, el otro es un huérfano legítimo)
      await enqueuePendingAvatarCleanup(userId, activeFileName);
      await enqueuePendingAvatarCleanup(userId, orphanFileName);

      mockRemove.mockResolvedValueOnce({ error: null });

      const processedCount = await processPendingAvatarCleanups(userId);

      // Solo debió eliminar el huérfano (1), NO el activo
      expect(processedCount).toBe(1);
      expect(mockRemove).toHaveBeenCalledWith([orphanFileName]);
      expect(mockRemove).not.toHaveBeenCalledWith([activeFileName]);

      // La cola debió quedar vacía (el huérfano se borró y el activo se descartó de la cola)
      const remaining = await getPendingCleanups();
      expect(remaining).toHaveLength(0);
    });
  });
});
