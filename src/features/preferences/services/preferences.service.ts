import { supabase } from "@/lib/supabase";
import {
    Category,
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

export async function saveUserPreferences({
    userId,
    movilidadPreferida,
    gastoMin,
    gastoMax,
    categoryIds,
}: SavePreferencesRequest) {
    const { error: preferencesError } = await supabase.from("preferencias_usuario").upsert({
        usuario_id: userId,
        movilidad_preferida: movilidadPreferida,
        gasto_min: gastoMin,
        gasto_max: gastoMax,
        updated_at: new Date().toISOString(),
    });

    if (preferencesError) {
        return { error: preferencesError };
    }

    const { error: deleteError } = await supabase
        .from("preferencias_usuario_categorias")
        .delete()
        .eq("usuario_id", userId);

    if (deleteError) {
        return { error: deleteError };
    }

    if (categoryIds.length > 0) {
        const rows = categoryIds.map(categoriaId => ({
            usuario_id: userId,
            categoria_id: categoriaId,
        }));

        const { error: insertError } = await supabase.from("preferencias_usuario_categorias").insert(rows);

        if (insertError) {
            return { error: insertError };
        }
    }

    return { error: null };
}
