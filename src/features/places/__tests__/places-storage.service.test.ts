import { describe, expect, it, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  PLACES_BUCKET,
  MAX_PLACE_IMAGE_SIZE_BYTES,
  ALLOWED_PLACE_IMAGE_MIMES,
  detectPlaceImageFormat,
  getPlaceImageUrl,
  isValidPlaceStoragePath,
  generatePlaceStoragePath,
  adminSetLugarPortada,
  deletePlaceImage,
  adminProcessPendingCleanups,
} from '../services/places-storage.service';

vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      storage: {
        from: vi.fn(),
      },
      rpc: vi.fn(),
    },
  };
});

describe('Places Storage Service - Manejo Multimedia Serie AX', () => {
  const mockFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;
  const mockStorageFrom = supabase.storage.from as unknown as ReturnType<typeof vi.fn>;
  const mockRpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constantes y Políticas de Configuración', () => {
    it('mantiene el bucket correcto places y límites de tamaño/formato', () => {
      expect(PLACES_BUCKET).toBe('places');
      expect(MAX_PLACE_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024);
      expect(ALLOWED_PLACE_IMAGE_MIMES).toContain('image/jpeg');
      expect(ALLOWED_PLACE_IMAGE_MIMES).toContain('image/png');
      expect(ALLOWED_PLACE_IMAGE_MIMES).toContain('image/webp');
    });
  });

  describe('detectPlaceImageFormat()', () => {
    it('detecta correctamente firmas binarias JPEG', () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      expect(detectPlaceImageFormat(bytes)).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    });

    it('detecta correctamente firmas binarias PNG', () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      expect(detectPlaceImageFormat(bytes)).toEqual({ mime: 'image/png', ext: 'png' });
    });

    it('detecta correctamente firmas binarias WebP', () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x20, 0x00, 0x00, 0x00, // file length
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      expect(detectPlaceImageFormat(bytes)).toEqual({ mime: 'image/webp', ext: 'webp' });
    });

    it('rechaza buffers cortos o formatos no autorizados (gif, exe, txt)', () => {
      expect(detectPlaceImageFormat(new Uint8Array([0x01, 0x02]))).toBeNull();
      // GIF (47 49 46 38)
      const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(detectPlaceImageFormat(gifBytes)).toBeNull();
    });
  });

  describe('Rutas de Storage: isValidPlaceStoragePath y generatePlaceStoragePath', () => {
    const validLugarId = '123e4567-e89b-12d3-a456-426614174000';
    const validFileId = '987fcdeb-51a2-43f7-9876-543210987654';

    it('valida rutas legítimas con formato {lugar_id}/{uuid}.{ext}', () => {
      const validPath = `${validLugarId}/${validFileId}.jpg`;
      expect(isValidPlaceStoragePath(validPath)).toBe(true);
      expect(isValidPlaceStoragePath(validPath, validLugarId)).toBe(true);
    });

    it('rechaza rutas con extensión no soportada o sin formato uuid', () => {
      expect(isValidPlaceStoragePath(`${validLugarId}/${validFileId}.gif`)).toBe(false);
      expect(isValidPlaceStoragePath(`${validLugarId}/malicious.jpg`)).toBe(false);
      expect(isValidPlaceStoragePath(`../traversal/${validFileId}.jpg`)).toBe(false);
    });

    it('rechaza rutas que no coinciden con el lugarId especificado', () => {
      const otherLugarId = '555e4567-e89b-12d3-a456-426614174000';
      const path = `${validLugarId}/${validFileId}.jpg`;
      expect(isValidPlaceStoragePath(path, otherLugarId)).toBe(false);
    });

    it('generatePlaceStoragePath genera una ruta válida para el destino', () => {
      const generated = generatePlaceStoragePath(validLugarId, 'webp');
      expect(isValidPlaceStoragePath(generated, validLugarId)).toBe(true);
      expect(generated.endsWith('.webp')).toBe(true);
      expect(generated.startsWith(`${validLugarId}/`)).toBe(true);
    });
  });

  describe('getPlaceImageUrl()', () => {
    it('retorna null para rutas vacías o inválidas', () => {
      expect(getPlaceImageUrl('')).toBeNull();
      expect(getPlaceImageUrl('   ')).toBeNull();
      expect(getPlaceImageUrl(null)).toBeNull();
      expect(getPlaceImageUrl(undefined)).toBeNull();
    });

    it('construye la URL pública delegando en storage.from(places).getPublicUrl', () => {
      const mockGetPublicUrl = vi.fn().mockReturnValue({
        data: { publicUrl: 'https://supabase.co/storage/v1/object/public/places/lugar/foto.jpg' },
      });
      mockStorageFrom.mockReturnValue({ getPublicUrl: mockGetPublicUrl });

      const url = getPlaceImageUrl('lugar/foto.jpg');
      expect(mockStorageFrom).toHaveBeenCalledWith(PLACES_BUCKET);
      expect(mockGetPublicUrl).toHaveBeenCalledWith('lugar/foto.jpg');
      expect(url).toBe('https://supabase.co/storage/v1/object/public/places/lugar/foto.jpg');
    });
  });

  describe('adminSetLugarPortada()', () => {
    it('invoca admin_set_lugar_portada exitosamente', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });

      const res = await adminSetLugarPortada('lugar-1', 'img-1');
      expect(mockRpc).toHaveBeenCalledWith('admin_set_lugar_portada', {
        p_lugar_id: 'lugar-1',
        p_imagen_id: 'img-1',
      });
      expect(res.success).toBe(true);
      expect(res.error).toBeNull();
    });

    it('retorna error cuando la RPC falla por permisos o validación', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Acceso denegado: se requieren privilegios de administrador' },
      });

      const res = await adminSetLugarPortada('lugar-1', 'img-1');
      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('Acceso denegado');
    });
  });

  describe('deletePlaceImage()', () => {
    it('elimina de DB, comprueba referencias, purga de Storage y marca la cola procesada', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }), // No referenciada
        }),
      });
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'lugares_imagenes') return { delete: mockDelete, select: mockSelect };
        if (table === 'lugares_imagenes_eliminadas') return { update: mockUpdate };
        return {};
      });

      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      mockStorageFrom.mockReturnValue({ remove: mockRemove });

      const res = await deletePlaceImage('img-123', 'lugar-1/foto.jpg');

      expect(res.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockRemove).toHaveBeenCalledWith(['lugar-1/foto.jpg']);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('no elimina físicamente de Storage si el archivo sigue referenciado por otra entrada', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [{ id: 'other-img' }], error: null }), // Sigue referenciada
        }),
      });
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'lugares_imagenes') return { delete: mockDelete, select: mockSelect };
        if (table === 'lugares_imagenes_eliminadas') return { update: mockUpdate };
        return {};
      });

      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      mockStorageFrom.mockReturnValue({ remove: mockRemove });

      const res = await deletePlaceImage('img-123', 'lugar-1/foto.jpg');

      expect(res.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalledWith('id');
      // No debió purgar el archivo físico de Storage
      expect(mockRemove).not.toHaveBeenCalled();
      // Pero sí marcó la cola como procesada
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('retorna error si la eliminación en base de datos falla', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Constraint violation' } }),
      });
      mockFrom.mockReturnValue({ delete: mockDelete });

      const res = await deletePlaceImage('img-123', 'lugar-1/foto.jpg');
      expect(res.success).toBe(false);
      expect(res.error?.message).toBe('Constraint violation');
    });
  });

  describe('adminProcessPendingCleanups()', () => {
    it('procesa elementos pendientes de la cola de limpieza en Storage purgando los no referenciados', async () => {
      const mockPendingItems = [
        { id: 'q-1', storage_path: 'lugar-1/foto1.jpg', is_referenced: false },
        { id: 'q-2', storage_path: 'lugar-2/foto2.jpg', is_referenced: false },
      ];

      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'admin_get_pending_storage_cleanups') {
          return Promise.resolve({ data: mockPendingItems, error: null });
        }
        if (fn === 'admin_mark_storage_cleanup_processed') {
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      mockStorageFrom.mockReturnValue({ remove: mockRemove });

      const result = await adminProcessPendingCleanups(10);
      expect(result.processedCount).toBe(2);
      expect(result.errors).toEqual([]);
      expect(mockRemove).toHaveBeenCalledTimes(2);
      expect(mockRpc).toHaveBeenCalledWith('admin_mark_storage_cleanup_processed', { p_id: 'q-1' });
      expect(mockRpc).toHaveBeenCalledWith('admin_mark_storage_cleanup_processed', { p_id: 'q-2' });
    });

    it('omite la eliminación física en Storage para archivos que siguen referenciados pero los marca procesados', async () => {
      const mockPendingItems = [
        { id: 'q-ref', storage_path: 'lugar-1/foto-activa.jpg', is_referenced: true },
        { id: 'q-unref', storage_path: 'lugar-1/foto-huerfana.jpg', is_referenced: false },
      ];

      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'admin_get_pending_storage_cleanups') {
          return Promise.resolve({ data: mockPendingItems, error: null });
        }
        if (fn === 'admin_mark_storage_cleanup_processed') {
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      mockStorageFrom.mockReturnValue({ remove: mockRemove });

      const result = await adminProcessPendingCleanups(10);
      expect(result.processedCount).toBe(2);
      // Solo debió purgar la que no está referenciada
      expect(mockRemove).toHaveBeenCalledTimes(1);
      expect(mockRemove).toHaveBeenCalledWith(['lugar-1/foto-huerfana.jpg']);
      // Ambos ítems fueron marcados como procesados
      expect(mockRpc).toHaveBeenCalledWith('admin_mark_storage_cleanup_processed', { p_id: 'q-ref' });
      expect(mockRpc).toHaveBeenCalledWith('admin_mark_storage_cleanup_processed', { p_id: 'q-unref' });
    });
  });
});
