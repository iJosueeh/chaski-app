import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export const AVATAR_BUCKET = 'avatars';
export const MIN_AVATAR_SIZE_BYTES = 100; 
export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const PENDING_CLEANUPS_KEY = '@chaski/pending_avatar_cleanups_v1';

const activeOperations = new Set<string>();

export interface ImageFormatInfo {
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  ext: 'jpg' | 'png' | 'webp';
}

export function detectImageFormat(bytes: Uint8Array): ImageFormatInfo | null {
  if (!bytes || bytes.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
    bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // WebP: RIFF ... WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  return null;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function readBinaryFromUri(localUri: string, base64?: string | null): Promise<Uint8Array> {
  if (base64) {
    return base64ToUint8Array(base64);
  }

  const response = await fetch(localUri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export interface PendingCleanupItem {
  userId: string;
  path: string;
  createdAt: string;
}

export interface ReplaceAvatarParams {
  userId: string;
  localUri: string;
  base64?: string | null;
  currentAvatarUrl?: string | null;
}

export interface ReplaceAvatarResult {
  success: boolean;
  avatarUrl?: string;
  user?: User;
  error?: string;
}

export interface RemoveAvatarParams {
  userId: string;
  currentAvatarUrl?: string | null;
}

export interface RemoveAvatarResult {
  success: boolean;
  user?: User;
  error?: string;
}

export function extractAvatarPath(url?: string | null, expectedUserId?: string): string | null {
  if (!url || typeof url !== 'string') return null;

  try {
    const cleanUrl = url.split('?')[0];

    const marker = `/${AVATAR_BUCKET}/`;
    const markerIndex = cleanUrl.indexOf(marker);

    let extracted: string;
    if (markerIndex !== -1) {
      extracted = cleanUrl.substring(markerIndex + marker.length);
    } else {
      extracted = cleanUrl.replace(/^\/+/, '');
    }

    if (!extracted || extracted.includes('..')) {
      return null;
    }

    if (expectedUserId) {
      const expectedPrefix = `${expectedUserId}/`;
      if (!extracted.startsWith(expectedPrefix)) {
        return null;
      }
    }

    return extracted;
  } catch {
    return null;
  }
}

export async function getPendingCleanups(): Promise<PendingCleanupItem[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_CLEANUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function enqueuePendingAvatarCleanup(userId: string, path: string): Promise<void> {
  if (!userId || !path) return;
  try {
    const current = await getPendingCleanups();
    if (current.some((item) => item.path === path)) return;

    const updated = [
      ...current,
      {
        userId,
        path,
        createdAt: new Date().toISOString(),
      },
    ];
    await AsyncStorage.setItem(PENDING_CLEANUPS_KEY, JSON.stringify(updated));
  } catch {
    // Silencioso para no romper la experiencia del usuario
  }
}

export async function processPendingAvatarCleanups(userId?: string): Promise<number> {
  const current = await getPendingCleanups();
  if (current.length === 0) return 0;

  const toProcess = userId ? current.filter((item) => item.userId === userId) : current;
  if (toProcess.length === 0) return 0;

  let activeAvatarPath: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const activeUrl = user.user_metadata?.avatar_url as string | undefined;
      activeAvatarPath = extractAvatarPath(activeUrl, user.id);
    }
  } catch {
  }

  let cleanedCount = 0;
  const remaining = [...current];

  for (const item of toProcess) {
    if (activeAvatarPath && item.path === activeAvatarPath) {
      const index = remaining.findIndex((r) => r.path === item.path);
      if (index !== -1) {
        remaining.splice(index, 1);
      }
      continue;
    }

    try {
      const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([item.path]);
      if (!error) {
        cleanedCount++;
        const index = remaining.findIndex((r) => r.path === item.path);
        if (index !== -1) {
          remaining.splice(index, 1);
        }
      }
    } catch {
    }
  }

  if (remaining.length !== current.length) {
    try {
      await AsyncStorage.setItem(PENDING_CLEANUPS_KEY, JSON.stringify(remaining));
    } catch {
      // Ignorar error de persistencia
    }
  }

  return cleanedCount;
}

export async function replaceUserAvatar({
  userId,
  localUri,
  base64,
  currentAvatarUrl,
}: ReplaceAvatarParams): Promise<ReplaceAvatarResult> {
  if (!userId) {
    return { success: false, error: 'Identificador de usuario no válido' };
  }

  if (!localUri && !base64) {
    return { success: false, error: 'Ruta de imagen local no especificada' };
  }

  if (activeOperations.has(userId)) {
    return { success: false, error: 'Ya hay una actualización de avatar en curso' };
  }

  activeOperations.add(userId);

  let newFilePath: string | null = null;

  try {
    let imageBytes: Uint8Array;
    try {
      imageBytes = await readBinaryFromUri(localUri, base64);
    } catch (readErr: any) {
      return {
        success: false,
        error: `Error al leer el archivo de imagen: ${readErr?.message ?? 'Lectura fallida'}`,
      };
    }

    // Validación de tamaño real de bytes
    if (!imageBytes || imageBytes.byteLength === 0) {
      return { success: false, error: 'El archivo de imagen seleccionado está vacío' };
    }

    if (imageBytes.byteLength < MIN_AVATAR_SIZE_BYTES) {
      return { success: false, error: 'El archivo es demasiado pequeño o está corrupto' };
    }

    if (imageBytes.byteLength > MAX_AVATAR_SIZE_BYTES) {
      return { success: false, error: 'La fotografía no debe superar los 2 MB de tamaño' };
    }

    // Inspección y validación de firma binaria (magic bytes)
    const formatInfo = detectImageFormat(imageBytes);
    if (!formatInfo) {
      return {
        success: false,
        error: 'El archivo seleccionado no es una imagen válida (debe ser JPEG, PNG o WebP)',
      };
    }

    // Ruta versionada única con extensión coherente con el tipo real
    const fileName = `avatar_${Date.now()}.${formatInfo.ext}`;
    newFilePath = `${userId}/${fileName}`;

    // Subir archivo a Supabase Storage con su verdadero contentType
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(newFilePath, imageBytes, {
        contentType: formatInfo.mime,
        upsert: true,
      });

    if (uploadError) {
      return {
        success: false,
        error: `Error al subir la fotografía: ${uploadError.message}`,
      };
    }

    // Obtener URL pública con timestamp de cache-busting
    const { data: publicData } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(newFilePath);

    const newPublicUrl = `${publicData.publicUrl}?t=${Date.now()}`;

    // Actualizar user_metadata en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.updateUser({
      data: {
        avatar_url: newPublicUrl,
      },
    });

    if (authError) {
      if (newFilePath) {
        try {
          const { error: rollbackError } = await supabase.storage.from(AVATAR_BUCKET).remove([newFilePath]);
          if (rollbackError) {
            await enqueuePendingAvatarCleanup(userId, newFilePath);
          }
        } catch {
          await enqueuePendingAvatarCleanup(userId, newFilePath);
        }
      }
      return {
        success: false,
        error: `Error al actualizar perfil: ${authError.message}`,
      };
    }

    // Eliminar avatar anterior si existía
    if (currentAvatarUrl) {
      const oldPath = extractAvatarPath(currentAvatarUrl, userId);

      // Verificar que pertenezca al usuario y no sea idéntico al nuevo
      if (oldPath && oldPath !== newFilePath && oldPath.startsWith(`${userId}/`)) {
        const { error: removeError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .remove([oldPath]);

        if (removeError) {
          // Registrar para reintento seguro
          await enqueuePendingAvatarCleanup(userId, oldPath);
        }
      }
    }

    // Procesar cualquier limpieza previa pendiente
    processPendingAvatarCleanups(userId).catch(() => {});

    return {
      success: true,
      avatarUrl: newPublicUrl,
      user: authData.user ?? undefined,
    };
  } catch (err: any) {
    // Si hubo excepción y ya se había subido el archivo nuevo, intentar rollback y encolar si falla
    if (newFilePath) {
      try {
        const { error: rollbackError } = await supabase.storage.from(AVATAR_BUCKET).remove([newFilePath]);
        if (rollbackError) {
          await enqueuePendingAvatarCleanup(userId, newFilePath);
        }
      } catch {
        await enqueuePendingAvatarCleanup(userId, newFilePath);
      }
    }
    return {
      success: false,
      error: err?.message ?? 'Ocurrió un error inesperado al procesar el avatar',
    };
  } finally {
    activeOperations.delete(userId);
  }
}

export async function removeUserAvatar({
  userId,
  currentAvatarUrl,
}: RemoveAvatarParams): Promise<RemoveAvatarResult> {
  if (!userId) {
    return { success: false, error: 'Identificador de usuario no válido' };
  }

  if (activeOperations.has(userId)) {
    return { success: false, error: 'Ya hay una actualización de avatar en curso' };
  }

  activeOperations.add(userId);

  try {
    // Quitar referencia en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.updateUser({
      data: {
        avatar_url: null,
      },
    });

    if (authError) {
      return {
        success: false,
        error: `No se pudo quitar la foto del perfil: ${authError.message}`,
      };
    }

    // Eliminar archivo físico en Supabase Storage
    if (currentAvatarUrl) {
      const oldPath = extractAvatarPath(currentAvatarUrl, userId);
      if (oldPath && oldPath.startsWith(`${userId}/`)) {
        const { error: removeError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .remove([oldPath]);

        if (removeError) {
          await enqueuePendingAvatarCleanup(userId, oldPath);
        }
      }
    }

    // Procesar cola de limpiezas
    processPendingAvatarCleanups(userId).catch(() => {});

    return {
      success: true,
      user: authData.user ?? undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message ?? 'Ocurrió un error inesperado al eliminar el avatar',
    };
  } finally {
    activeOperations.delete(userId);
  }
}
