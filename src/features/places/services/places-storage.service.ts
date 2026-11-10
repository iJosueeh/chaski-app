import { supabase } from "@/lib/supabase";
import { readBinaryFromUri } from "@/shared/utils/image-bytes";
import {
  PLACES_BUCKET,
  generatePlaceStoragePath,
  validatePlaceImageBytes,
} from "../utils/place-image";

// Se reexportan porque ya formaban parte de la API de este modulo; la logica
// pura vive en features/places/utils/place-image.ts.
export {
  ALLOWED_PLACE_IMAGE_MIMES,
  MAX_PLACE_IMAGE_SIZE_BYTES,
  PLACES_BUCKET,
  detectPlaceImageFormat,
  generatePlaceStoragePath,
  isValidPlaceStoragePath,
  validatePlaceImageBytes,
} from "../utils/place-image";
export type {
  PlaceImageFormatInfo,
  PlaceImageMimeType,
  PlaceImageValidation,
} from "../utils/place-image";


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

export interface UploadPlaceImageParams {
  lugarId: string;
  localUri: string;
  base64?: string | null;
}

export interface UploadPlaceImageResult {
  success: boolean;
  imagenId?: string;
  storagePath?: string;
  publicUrl?: string | null;
  error?: string;
}

/**
 * Sube una foto al bucket `places` y registra la fila en `lugares_imagenes`.
 * Si la fila no se puede crear, se borra el archivo para no dejar huérfanos.
 */
export async function uploadPlaceImage({
  lugarId,
  localUri,
  base64,
}: UploadPlaceImageParams): Promise<UploadPlaceImageResult> {
  try {
    const bytes = await readBinaryFromUri(localUri, base64);
    const { format, error } = validatePlaceImageBytes(bytes);

    if (!format) {
      return { success: false, error: error ?? "Imagen no válida" };
    }

    const storagePath = generatePlaceStoragePath(lugarId, format.ext);
    const { error: uploadError } = await supabase.storage
      .from(PLACES_BUCKET)
      .upload(storagePath, bytes, { contentType: format.mime, upsert: false });

    if (uploadError) {
      return { success: false, error: `Error al subir la imagen: ${uploadError.message}` };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("lugares_imagenes")
      .insert({ lugar_id: lugarId, storage_path: storagePath, es_portada: false })
      .select("id")
      .single();

    if (insertError) {
      await supabase.storage.from(PLACES_BUCKET).remove([storagePath]);
      return { success: false, error: `No se registró la imagen: ${insertError.message}` };
    }

    return {
      success: true,
      imagenId: inserted?.id as string | undefined,
      storagePath,
      publicUrl: getPlaceImageUrl(storagePath),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al procesar la imagen",
    };
  }
}
