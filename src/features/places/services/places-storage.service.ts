import { supabase } from "@/lib/supabase";

export const PLACES_BUCKET = "places";
export const MAX_PLACE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_PLACE_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PlaceImageMimeType = (typeof ALLOWED_PLACE_IMAGE_MIMES)[number];

export interface PlaceImageFormatInfo {
  mime: PlaceImageMimeType;
  ext: "jpg" | "png" | "webp";
}

export function detectPlaceImageFormat(
  bytes: Uint8Array,
): PlaceImageFormatInfo | null {
  if (!bytes || bytes.length < 12) {
    return null;
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}

export function getPlaceImageUrl(
  storagePath: string | null | undefined,
): string | null {
  if (
    !storagePath ||
    typeof storagePath !== "string" ||
    storagePath.trim() === ""
  ) {
    return null;
  }

  const { data } = supabase.storage
    .from(PLACES_BUCKET)
    .getPublicUrl(storagePath.trim());
  return data?.publicUrl ?? null;
}

export function isValidPlaceStoragePath(
  storagePath: string,
  lugarId?: string,
): boolean {
  if (!storagePath || typeof storagePath !== "string") return false;

  const regex = /^[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$/;
  if (!regex.test(storagePath)) return false;

  if (lugarId) {
    return storagePath.toLowerCase().startsWith(`${lugarId.toLowerCase()}/`);
  }

  return true;
}

export function generatePlaceStoragePath(
  lugarId: string,
  extension: "jpg" | "png" | "webp",
): string {
  const fileUuid = crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
  return `${lugarId}/${fileUuid}.${extension}`;
}

export async function adminSetLugarPortada(
  lugarId: string,
  imagenId: string,
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase.rpc("admin_set_lugar_portada", {
      p_lugar_id: lugarId,
      p_imagen_id: imagenId,
    });

    if (error) {
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err
          : new Error("Error al asignar portada del destino"),
    };
  }
}

export async function deletePlaceImage(
  imagenId: string,
  storagePath: string,
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error: dbError } = await supabase
      .from("lugares_imagenes")
      .delete()
      .eq("id", imagenId);

    if (dbError) {
      return { success: false, error: new Error(dbError.message) };
    }

    const { data: stillReferenced } = await supabase
      .from("lugares_imagenes")
      .select("id")
      .eq("storage_path", storagePath)
      .limit(1);

    if (stillReferenced && stillReferenced.length > 0) {
      await supabase
        .from("lugares_imagenes_eliminadas")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("storage_path", storagePath)
        .eq("processed", false);

      return { success: true, error: null };
    }

    const { error: storageError } = await supabase.storage
      .from(PLACES_BUCKET)
      .remove([storagePath]);

    if (!storageError) {
      await supabase
        .from("lugares_imagenes_eliminadas")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("storage_path", storagePath)
        .eq("processed", false);
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err
          : new Error("Error al eliminar la imagen del destino"),
    };
  }
}

export interface PendingCleanupItem {
  id: string;
  storage_path: string;
  bucket_id: string;
  lugar_id: string;
  created_at: string;
  is_referenced?: boolean;
}

export async function adminProcessPendingCleanups(
  limit: number = 20,
): Promise<{ processedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let processedCount = 0;

  try {
    const { data: pending, error } = await supabase.rpc(
      "admin_get_pending_storage_cleanups",
      {
        p_limit: limit,
      },
    );

    if (error) {
      return { processedCount: 0, errors: [error.message] };
    }

    const items = (pending ?? []) as PendingCleanupItem[];

    for (const item of items) {
      try {
        if (item.is_referenced) {
          await supabase.rpc("admin_mark_storage_cleanup_processed", {
            p_id: item.id,
          });
          processedCount++;
          continue;
        }

        const { error: removeErr } = await supabase.storage
          .from(PLACES_BUCKET)
          .remove([item.storage_path]);

        if (removeErr) {
          errors.push(
            `Error al purgar ${item.storage_path}: ${removeErr.message}`,
          );
          continue;
        }

        await supabase.rpc("admin_mark_storage_cleanup_processed", {
          p_id: item.id,
        });
        processedCount++;
      } catch (e) {
        errors.push(
          `Fallo en limpieza ${item.storage_path}: ${e instanceof Error ? e.message : "Desconocido"}`,
        );
      }
    }

    return { processedCount, errors };
  } catch (e) {
    return {
      processedCount: 0,
      errors: [e instanceof Error ? e.message : "Error inesperado"],
    };
  }
}
