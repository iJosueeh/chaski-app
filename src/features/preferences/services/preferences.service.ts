import { supabase } from "@/lib/supabase";
import {
    Category,
    type SaveAtomicPreferencesRequest,
    type SaveAtomicPreferencesResult,
    type SavePreferencesRequest,
    type UserPreferencesWithCategories,
} from "../interfaces/preferences.interface";

export async function getActiveCategories() {
    const { data, error } = await supabase
        .from("categorias")
        .select("id, nombre, descripcion, estado")
        .eq("estado", true)
        .order("nombre");

    return { data: data as Category[], error };
}

export async function getUserPreferences(userId: string) {
    const { data: preferences, error: preferencesError } = await supabase
        .from("preferencias_usuario")
        .select(
            `
            usuario_id,
            movilidad_preferida,
            gasto_min,
            gasto_max
            `,
        )
        .eq("usuario_id", userId)
        .maybeSingle();

    if (preferencesError) {
        return {
            data: null,
            error: preferencesError,
        };
    }

    if (!preferences) {
        return {
            data: null,
            error: null,
        };
    }

    const { data: categoryRelations, error: categoriesError } = await supabase
        .from("preferencias_usuario_categorias")
        .select(
            `
            categorias (
            id,
            nombre,
            descripcion,
            estado
            )
            `,
        )
        .eq("usuario_id", userId);

    if (categoriesError) {
        return {
            data: null,
            error: categoriesError,
        };
    }

    const categorias: Category[] = categoryRelations?.flatMap(item => item.categorias ?? []) ?? [];

    const result: UserPreferencesWithCategories = {
        usuario_id: preferences.usuario_id,
        movilidad_preferida: preferences.movilidad_preferida,
        gasto_min: preferences.gasto_min,
        gasto_max: preferences.gasto_max,
        categorias,
    };

    return { data: result, error: null };
}

export async function saveUserPreferencesAtomic({
    categoryIds,
    gastoMin = null,
    gastoMax = null,
    movilidadPreferida = null,
    actualizarMovilidad = false,
}: SaveAtomicPreferencesRequest) {
    const { data, error } = await supabase.rpc("save_user_preferences_atomic", {
        p_category_ids: categoryIds,
        p_gasto_min: gastoMin,
        p_gasto_max: gastoMax,
        p_movilidad_preferida: movilidadPreferida,
        p_actualizar_movilidad: actualizarMovilidad,
    });

    if (error) {
        return {
            data: null,
            error,
        };
    }

    return {
        data: data as SaveAtomicPreferencesResult,
        error: null,
    };
}

export async function saveUserPreferences({
    movilidadPreferida,
    gastoMin,
    gastoMax,
    categoryIds,
}: SavePreferencesRequest) {
    const { error } = await saveUserPreferencesAtomic({
        categoryIds,
        gastoMin,
        gastoMax,
        movilidadPreferida,
        actualizarMovilidad: movilidadPreferida !== null && movilidadPreferida !== undefined,
    });

    return { error };
}

