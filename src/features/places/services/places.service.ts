import { supabase } from "@/lib/supabase";
import type { Place } from "../interface/places.interface";

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

    const places: Place[] = (data ?? []).map(place => ({
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
        fecha_actualizacion: place.fecha_actualizacion,

        horarios: place.horarios_lugar ?? [],

        categorias: place.lugares_categorias?.flatMap(relation => relation.categorias ?? []) ?? [],

        etiquetas: place.lugares_etiquetas?.flatMap(relation => relation.etiquetas ?? []) ?? [],
    }));

    return {
        data: places,
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

    const place: Place = {
        id: data?.id,
        nombre: data?.nombre,
        descripcion: data?.descripcion,

        latitud: data?.latitud,
        longitud: data?.longitud,
        direccion: data?.direccion,

        gasto_min: data?.gasto_min,
        gasto_max: data?.gasto_max,

        duracion_sugerida_min: data?.duracion_sugerida_min,

        estado: data?.estado,
        fuente: data?.fuente,
        external_id: data?.external_id,
        fecha_actualizacion: data?.fecha_actualizacion,

        horarios: data?.horarios_lugar ?? [],

        categorias: data?.lugares_categorias?.flatMap(relation => relation.categorias ?? []) ?? [],

        etiquetas: data?.lugares_etiquetas?.flatMap(relation => relation.etiquetas ?? []) ?? [],
    };

    return {
        data: place,
        error: null,
    };
}
