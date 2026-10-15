import { supabase } from "@/lib/supabase";
import type { Place, PlaceImage } from "../interface/places.interface";
import { getPlaceImageUrl } from "./places-storage.service";

interface RawLugarImagen {
    id: string;
    lugar_id: string;
    storage_path: string;
    es_portada: boolean;
    orden: number;
    created_at?: string;
}

export function mapPlaceImages(rawImages?: RawLugarImagen[] | null): {
    imagen_portada: string | null;
    imagenes: PlaceImage[];
} {
    if (!rawImages || !Array.isArray(rawImages) || rawImages.length === 0) {
        return {
            imagen_portada: null,
            imagenes: [],
        };
    }

    const sorted = [...rawImages].sort((a, b) => {
        if (a.orden !== b.orden) return a.orden - b.orden;
        return (a.created_at || '').localeCompare(b.created_at || '');
    });

    const portadaRaw = sorted.find(img => img.es_portada) ?? sorted[0] ?? null;
    const imagen_portada = portadaRaw ? getPlaceImageUrl(portadaRaw.storage_path) : null;

    const imagenes: PlaceImage[] = sorted.map(img => ({
        id: img.id,
        lugar_id: img.lugar_id,
        storage_path: img.storage_path,
        url: getPlaceImageUrl(img.storage_path) ?? '',
        es_portada: Boolean(img.es_portada),
        orden: img.orden,
        created_at: img.created_at,
    }));

    return {
        imagen_portada,
        imagenes,
    };
}

export async function getActivePlaces() {
    const { data, error } = await supabase
        .from("lugares")
        .select(
            `
      id,
      nombre,
      descripcion,
      latitud,
      longitud,
      direccion,
      gasto_min,
      gasto_max,
      duracion_sugerida_min,
      estado,
      fuente,
      external_id,
      tipo_disponibilidad,
      fecha_actualizacion,

      horarios_lugar (
        id,
        dia_semana,
        hora_apertura,
        hora_cierre
      ),

      lugares_categorias (
        categorias (
          id,
          nombre
        )
      ),

      lugares_etiquetas (
        etiquetas (
          id,
          nombre
        )
      ),

      lugares_imagenes (
        id,
        lugar_id,
        storage_path,
        es_portada,
        orden,
        created_at
      )
    `,
        )
        .eq("estado", true)
        .order("nombre");

    if (error) {
        return {
            data: null,
            error,
        };
    }

    const places: Place[] = (data ?? []).map(place => {
        const { imagen_portada, imagenes } = mapPlaceImages(
            (place as any).lugares_imagenes as RawLugarImagen[] | undefined
        );

        return {
            id: place.id,
            nombre: place.nombre,
            descripcion: place.descripcion,
            latitud: place.latitud,
            longitud: place.longitud,
            direccion: place.direccion,
            gasto_min: place.gasto_min,
            gasto_max: place.gasto_max,
            duracion_sugerida_min: place.duracion_sugerida_min,
            estado: place.estado,
            fuente: place.fuente,
            external_id: place.external_id,
            tipo_disponibilidad: place.tipo_disponibilidad,
            fecha_actualizacion: place.fecha_actualizacion,
            horarios: place.horarios_lugar ?? [],
            categorias: (() => {
                const rawCats: any[] = place.lugares_categorias?.flatMap((relation: any) => relation.categorias ?? []) ?? [];
                const seenCatIds = new Set<string>();
                return rawCats.filter(cat => {
                    if (!cat?.id || seenCatIds.has(cat.id)) return false;
                    seenCatIds.add(cat.id);
                    return true;
                });
            })(),
            etiquetas: place.lugares_etiquetas?.flatMap((relation: any) => relation.etiquetas ?? []) ?? [],
            imagen_portada,
            imagenes,
        };
    });

    const seenIds = new Set<string>();
    const uniquePlaces: Place[] = [];
    for (const p of places) {
        if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            uniquePlaces.push(p);
        }
    }

    return {
        data: uniquePlaces,
        error: null,
    };
}

export async function getPlaceById(placeId: string) {
    const { data, error } = await supabase
        .from("lugares")
        .select(
            `
        id,
        nombre,
        descripcion,
        latitud,
        longitud,
        direccion,
        gasto_min,
        gasto_max,
        duracion_sugerida_min,
        estado,
        fuente,
        external_id,
        tipo_disponibilidad,
        fecha_actualizacion,

        horarios_lugar (
            id,
            dia_semana,
            hora_apertura,
            hora_cierre
        ),

        lugares_categorias (
            categorias (
            id,
            nombre
            )
        ),

        lugares_etiquetas (
            etiquetas (
            id,
            nombre
            )
        ),

        lugares_imagenes (
            id,
            lugar_id,
            storage_path,
            es_portada,
            orden,
            created_at
        )
        `,
        )
        .eq("id", placeId)
        .eq("estado", true)
        .maybeSingle();

    if (error) {
        return {
            data: null,
            error,
        };
    }

    if (!data) {
        return {
            data: null,
            error: null,
        };
    }

    const { imagen_portada, imagenes } = mapPlaceImages(
        (data as any).lugares_imagenes as RawLugarImagen[] | undefined
    );

    const place: Place = {
        id: data.id,
        nombre: data.nombre,
        descripcion: data.descripcion,
        latitud: data.latitud,
        longitud: data.longitud,
        direccion: data.direccion,
        gasto_min: data.gasto_min,
        gasto_max: data.gasto_max,
        duracion_sugerida_min: data.duracion_sugerida_min,
        estado: data.estado,
        fuente: data.fuente,
        external_id: data.external_id,
        tipo_disponibilidad: data.tipo_disponibilidad,
        fecha_actualizacion: data.fecha_actualizacion,
        horarios: data.horarios_lugar ?? [],
        categorias: data.lugares_categorias?.flatMap((relation: any) => relation.categorias ?? []) ?? [],
        etiquetas: data.lugares_etiquetas?.flatMap((relation: any) => relation.etiquetas ?? []) ?? [],
        imagen_portada,
        imagenes,
    };

    return {
        data: place,
        error: null,
    };
}
