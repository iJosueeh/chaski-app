/**
 * Datos y acciones de la gestión de fotos de los destinos.
 *
 * La pantalla solo se encarga de pintar: aquí se resuelve qué imagen es la
 * portada, la subida al bucket y la limpieza de archivos pendientes.
 */

import { useCallback, useEffect, useState } from 'react';

import type { Place } from '@/features/places/interface/places.interface';
import { getActivePlaces } from '@/features/places/services/places.service';
import {
  adminProcessPendingCleanups,
  adminSetLugarPortada,
  deletePlaceImage,
  uploadPlaceImage,
} from '@/features/places/services/places-storage.service';

export interface UploadPlacePhotoParams {
  place: Place;
  localUri: string;
  base64?: string | null;
  /** true para dejar la foto recién subida como portada del destino. */
  asCover: boolean;
}

export interface PhotoActionResult {
  success: boolean;
  error?: string;
}

export interface UseAdminPlacesResult {
  places: Place[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  uploadPhoto: (params: UploadPlacePhotoParams) => Promise<PhotoActionResult>;
  removePhoto: (place: Place) => Promise<PhotoActionResult>;
  runCleanup: () => Promise<{ processedCount: number; errors: string[] }>;
}

export function useAdminPlaces(): UseAdminPlacesResult {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await getActivePlaces();
      if (fetchError) {
        setError('No se pudo cargar el catálogo de destinos.');
        return;
      }
      setPlaces(data ?? []);
    } catch {
      setError('No se pudo cargar el catálogo de destinos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // La carga inicial la dispara el montaje de la pantalla.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const uploadPhoto = useCallback(
    async ({ place, localUri, base64, asCover }: UploadPlacePhotoParams): Promise<PhotoActionResult> => {
      const subida = await uploadPlaceImage({ lugarId: place.id, localUri, base64 });

      if (!subida.success || !subida.imagenId) {
        return { success: false, error: subida.error ?? 'No se pudo subir la foto.' };
      }

      if (asCover) {
        const portada = await adminSetLugarPortada(place.id, subida.imagenId);
        if (!portada.success) {
          return {
            success: false,
            error:
              portada.error?.message ??
              'La foto se subió, pero no se pudo marcar como portada.',
          };
        }
      }

      await reload();
      return { success: true };
    },
    [reload],
  );

  const removePhoto = useCallback(
    async (place: Place): Promise<PhotoActionResult> => {
      const portada = place.imagenes?.find((imagen) => imagen.es_portada) ?? null;

      if (!portada) {
        return { success: false, error: 'Este destino no tiene portada que quitar.' };
      }

      const borrado = await deletePlaceImage(portada.id, portada.storage_path);
      if (!borrado.success) {
        return { success: false, error: borrado.error?.message ?? 'No se pudo quitar la foto.' };
      }

      await reload();
      return { success: true };
    },
    [reload],
  );

  const runCleanup = useCallback(async () => {
    const resultado = await adminProcessPendingCleanups();
    await reload();
    return resultado;
  }, [reload]);

  return { places, loading, error, reload, uploadPhoto, removePhoto, runCleanup };
}
