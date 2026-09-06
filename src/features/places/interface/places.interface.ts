export interface PlaceCategory {
    id: string;
    nombre: string;
}

export interface PlaceTag {
    id: string;
    nombre: string;
}

export interface PlaceSchedule {
    id: string;
    dia_semana: number;
    hora_apertura: string;
    hora_cierre: string;
}

export interface Place {
    id: string;
    nombre: string;
    descripcion: string | null;

    latitud: number;
    longitud: number;
    direccion: string | null;

    gasto_min: number | null;
    gasto_max: number | null;

    duracion_sugerida_min: number | null;

    estado: boolean;
    fuente: string;
    external_id: string | null;
    fecha_actualizacion: string;

    categorias: PlaceCategory[];
    etiquetas: PlaceTag[];
    horarios: PlaceSchedule[];
}
