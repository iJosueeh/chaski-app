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
