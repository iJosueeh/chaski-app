/**
 * Tipos e interfaces para la persistencia de public.solicitudes_plan
 * y public.solicitudes_plan_categorias en Supabase.
 */

import type { ExpedicionHistorialEntry } from './expediciones-plan.interface';

export type MovilidadSolicitud = 'CAMINANDO' | 'TRANSPORTE_PUBLICO' | 'AUTO';

export type TipoPuntoFinal = 'REGRESAR_INICIO' | 'ULTIMA_PARADA' | 'OTRA_UBICACION';

export interface SolicitudPlanRow {
  id: string; // uuid
  usuario_id: string; // uuid FK -> usuarios(id)
  fecha_hora_inicio: string; // timestamptz
  fecha_hora_fin: string; // timestamptz
  inicio_latitud: number; // double precision [-90, 90]
  inicio_longitud: number; // double precision [-180, 180]
  inicio_descripcion: string | null;
  tipo_punto_final: TipoPuntoFinal;
  final_latitud: number | null; // double precision [-90, 90]
  final_longitud: number | null; // double precision [-180, 180]
  final_descripcion: string | null;
  gasto_min: number | null; // numeric >= 0
  gasto_max: number | null; // numeric >= 0
  movilidad: MovilidadSolicitud;
  fecha_creacion: string; // timestamptz
}

export interface SolicitudPlanCategoriaRow {
  solicitud_id: string; // uuid FK -> solicitudes_plan(id)
  categoria_id: string; // uuid FK -> categorias(id)
}

export interface SolicitudHistorialEntry extends SolicitudPlanRow {
  categorias: string[];
  expedicion: ExpedicionHistorialEntry | null;
}

export interface ListarSolicitudesHistorialResult {
  data: SolicitudHistorialEntry[];
  error: SolicitudPlanServiceError | null;
}

export interface GuardarSolicitudPlanInput {
  userId: string;
  inicioLatitud: number;
  inicioLongitud: number;
  inicioDescripcion?: string | null;
  fechaHoraInicio: string;
  fechaHoraFin: string;
  tipoPuntoFinal?: TipoPuntoFinal;
  finalLatitud?: number | null;
  finalLongitud?: number | null;
  finalDescripcion?: string | null;
  gastoMin?: number | null;
  gastoMax?: number | null;
  movilidad: MovilidadSolicitud;
  categoriaIds?: string[];
  forceNew?: boolean;
}

export type SolicitudPlanErrorType =
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'DATABASE_ERROR';

export interface SolicitudPlanServiceError {
  type: SolicitudPlanErrorType;
  message: string;
  originalError?: unknown;
  code?: string;
}

export interface GuardarSolicitudPlanResult {
  data: SolicitudPlanRow | null;
  error: SolicitudPlanServiceError | null;
}
