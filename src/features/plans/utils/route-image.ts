/**
 * Utilidad para resolver la imagen de portada de una ruta/plan
 * a partir de las imágenes de sus lugares (public.lugares_imagenes).
 *
 * Archivo: src/features/plans/utils/route-image.ts
 */
import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';
import { getPlaceImageUrl } from '@/features/places/services/places-storage.service';
import { supabase } from '@/lib/supabase';

/** Caché en memoria para asociar lugar_id y nombre de lugar con su imagen de portada. */
const placeCoverImagesCache = new Map<string, string>();

export function clearPlaceCoverImagesCache(): void {
  placeCoverImagesCache.clear();
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function cachePlaceCoverImage(
  id: string,
  nombre?: string | null,
  url?: string | null,
): void {
  if (!url) return;
  if (id) {
    placeCoverImagesCache.set(id, url);
  }
  if (nombre) {
    placeCoverImagesCache.set(normalize(nombre), url);
  }
}

/**
 * Consulta `lugares_imagenes` y `lugares` en Supabase para precargar el catálogo
 * de imágenes de portada en memoria.
 */
export async function loadPlaceCoverImages(
  client: typeof supabase = supabase,
): Promise<Map<string, string>> {
  try {
    const [lugaresRes, imagenesRes] = await Promise.all([
      client
        .from('lugares')
        .select('id, nombre, lugares_imagenes ( storage_path, es_portada )')
        .eq('estado', true),
      client
        .from('lugares_imagenes')
        .select('lugar_id, storage_path, es_portada')
        .order('es_portada', { ascending: false }),
    ]);

    // 1. Mapear desde imagenes directas por lugar_id
    if (imagenesRes.data) {
      for (const row of imagenesRes.data) {
        if (!placeCoverImagesCache.has(row.lugar_id) && row.storage_path) {
          const url = getPlaceImageUrl(row.storage_path);
          if (url) {
            placeCoverImagesCache.set(row.lugar_id, url);
          }
        }
      }
    }

    // 2. Mapear desde lugares con nombre
    if (lugaresRes.data) {
      for (const place of lugaresRes.data) {
        const imgs = (place as any).lugares_imagenes as
          | { storage_path: string; es_portada: boolean }[]
          | undefined;
        if (!imgs || imgs.length === 0) continue;
        const portada = imgs.find((i) => i.es_portada) ?? imgs[0];
        if (portada?.storage_path) {
          const url = getPlaceImageUrl(portada.storage_path);
          if (url) {
            cachePlaceCoverImage(place.id, place.nombre, url);
          }
        }
      }
    }

    return placeCoverImagesCache;
  } catch {
    return placeCoverImagesCache;
  }
}

/**
 * Resuelve la URL pública de la imagen de portada de la ruta.
 * 1. Revisa las paradas del plan (imagen_portada directa, imagenes o búsqueda en caché por id/nombre).
 * 2. Si no hay plan/paradas, usa el fallback (inicio_descripcion o nombre del lugar).
 */
export function getRouteCoverImage(
  plan?: GeneratedPlan | null,
  fallback?: string | null,
): string | null {
  // 1. Buscar en paradas del plan
  if (plan?.paradas && Array.isArray(plan.paradas) && plan.paradas.length > 0) {
    for (const parada of plan.paradas) {
      const place = parada?.place;
      if (!place) continue;

      // a. imagen_portada directa
      if (place.imagen_portada && typeof place.imagen_portada === 'string') {
        const trimmed = place.imagen_portada.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          return trimmed;
        }
        const url = getPlaceImageUrl(trimmed);
        if (url) return url;
      }

      // b. Colección de imágenes
      if (Array.isArray(place.imagenes) && place.imagenes.length > 0) {
        const portadaImg = place.imagenes.find((img) => img.es_portada) ?? place.imagenes[0];
        if (portadaImg?.url && typeof portadaImg.url === 'string') {
          const trimmed = portadaImg.url.trim();
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return trimmed;
          }
        }
        if (portadaImg?.storage_path) {
          const url = getPlaceImageUrl(portadaImg.storage_path);
          if (url) return url;
        }
      }

      // c. Búsqueda en caché por id del lugar
      if (place.id && placeCoverImagesCache.has(place.id)) {
        return placeCoverImagesCache.get(place.id)!;
      }

      // d. Búsqueda en caché por nombre del lugar
      if (place.nombre) {
        const norm = normalize(place.nombre);
        if (placeCoverImagesCache.has(norm)) {
          return placeCoverImagesCache.get(norm)!;
        }
      }
    }
  }

  // 2. Buscar por fallback (nombre del lugar o inicio_descripcion de la solicitud)
  if (fallback && typeof fallback === 'string') {
    const trimmed = fallback.trim();
    if (placeCoverImagesCache.has(trimmed)) {
      return placeCoverImagesCache.get(trimmed)!;
    }
    const norm = normalize(trimmed);
    if (placeCoverImagesCache.has(norm)) {
      return placeCoverImagesCache.get(norm)!;
    }
    // Coincidencia parcial (ej. "Expedición desde Canta Rana" contiene "canta rana")
    for (const [key, url] of placeCoverImagesCache.entries()) {
      if (key.length >= 4 && norm.includes(key)) {
        return url;
      }
    }
  }

  return null;
}
