export interface Category {
    id: string;
    nombre: string;
    descripcion: string | null;
    estado: boolean;
}

export interface UserPreferences {
    usuario_id: string;
    movilidad_preferida: string | null;
    gasto_min: number | null;
    gasto_max: number | null;
}

export type UserPreferencesWithCategories = UserPreferences & {
    categorias: Category[];
};

export interface SavePreferencesRequest {
    userId: string;
    movilidadPreferida: string | null;
    gastoMin: number | null;
    gastoMax: number | null;
    categoryIds: string[];
}

export interface PreferencesFormData {
    categoryIds: string[];
    gastoMin: number | null;
    gastoMax: number | null;
}

export interface SaveAtomicPreferencesRequest {
    categoryIds: string[];
    gastoMin?: number | null;
    gastoMax?: number | null;
    movilidadPreferida?: string | null;
    actualizarMovilidad?: boolean;
}

export interface SaveAtomicPreferencesResult {
    success: boolean;
    usuario_id: string;
    categories_saved: number;
    updated_at: string;
}


