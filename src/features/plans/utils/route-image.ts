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

export interface RouteCoverImageItem {
  url: string;
  placeName: string;
  order?: number;
}

/**
 * Resuelve la colección completa de imágenes de las paradas de la ruta.
 * - Si hay múltiples paradas con imágenes, retorna todas en orden de visita.
 * - Si no hay paradas o no tienen fotos, resuelve desde el fallback (inicio_descripcion o nombre).
 */
export function getRouteCoverImages(
  plan?: GeneratedPlan | null,
  fallback?: string | null,
): RouteCoverImageItem[] {
  const items: RouteCoverImageItem[] = [];
  const seenUrls = new Set<string>();

  // 1. Recorrer paradas del plan
  if (plan?.paradas && Array.isArray(plan.paradas) && plan.paradas.length > 0) {
    for (const parada of plan.paradas) {
      const place = parada?.place;
      if (!place) continue;

      let foundUrl: string | null = null;

      // a. imagen_portada directa
      if (place.imagen_portada && typeof place.imagen_portada === 'string') {
        const trimmed = place.imagen_portada.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          foundUrl = trimmed;
        } else {
          const url = getPlaceImageUrl(trimmed);
          if (url) foundUrl = url;
        }
      }

      // b. Colección de imágenes
      if (!foundUrl && Array.isArray(place.imagenes) && place.imagenes.length > 0) {
        const portadaImg = place.imagenes.find((img) => img.es_portada) ?? place.imagenes[0];
        if (portadaImg?.url && typeof portadaImg.url === 'string') {
          const trimmed = portadaImg.url.trim();
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            foundUrl = trimmed;
          }
        }
        if (!foundUrl && portadaImg?.storage_path) {
          const url = getPlaceImageUrl(portadaImg.storage_path);
          if (url) foundUrl = url;
        }
      }

      // c. Búsqueda en caché por id
      if (!foundUrl && place.id && placeCoverImagesCache.has(place.id)) {
        foundUrl = placeCoverImagesCache.get(place.id)!;
      }

      // d. Búsqueda en caché por nombre
      if (!foundUrl && place.nombre) {
        const norm = normalize(place.nombre);
        if (placeCoverImagesCache.has(norm)) {
          foundUrl = placeCoverImagesCache.get(norm)!;
        }
      }

      if (foundUrl && !seenUrls.has(foundUrl)) {
        seenUrls.add(foundUrl);
        items.push({
          url: foundUrl,
          placeName: place.nombre ?? `Parada ${parada.orden}`,
          order: parada.orden,
        });
      }
    }
  }

  // 2. Si no hay imágenes en paradas, resolver desde fallback
  if (items.length === 0 && fallback && typeof fallback === 'string') {
    const trimmed = fallback.trim();
    let fallbackUrl: string | null = null;

    if (placeCoverImagesCache.has(trimmed)) {
      fallbackUrl = placeCoverImagesCache.get(trimmed)!;
    } else {
      const norm = normalize(trimmed);
      if (placeCoverImagesCache.has(norm)) {
        fallbackUrl = placeCoverImagesCache.get(norm)!;
      } else {
        for (const [key, url] of placeCoverImagesCache.entries()) {
          if (key.length >= 4 && norm.includes(key)) {
            fallbackUrl = url;
            break;
          }
        }
      }
    }

    if (fallbackUrl) {
      const cleanName = trimmed.replace(/^Expedición\s+(desde\s+)?/i, '').trim();
      items.push({
        url: fallbackUrl,
        placeName: cleanName || 'Destino patrimonial',
      });
    }
  }

  return items;
}

/**
 * Resuelve la URL pública de la imagen de portada principal de la ruta.
 * Reutiliza `getRouteCoverImages` para consistencia.
 */
export function getRouteCoverImage(
  plan?: GeneratedPlan | null,
  fallback?: string | null,
): string | null {
  const images = getRouteCoverImages(plan, fallback);
  return images.length > 0 ? images[0].url : null;
}
