import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';

import type { EstadoExpedicion } from './plans.interface';
import type { SolicitudPlanServiceError } from './solicitudes-plan.interface';

export interface ExpedicionPlanRow {
  solicitud_id: string;
  usuario_id: string;
  estado_expedicion: EstadoExpedicion;
  completado_en: string;
  plan_snapshot: GeneratedPlan;
  paradas_visitadas: number[];
  paradas_visitadas_ids: string[];
}

export interface ExpedicionHistorialEntry {
  estado_expedicion: EstadoExpedicion;
  completado_en: string | null;
  plan_snapshot: GeneratedPlan | null;
  paradas_visitadas: number[];
  paradas_visitadas_ids: string[];
}

export interface GuardarExpedicionInput {
  solicitudId: string;
  usuarioId: string;
  estadoExpedicion: EstadoExpedicion;
  completadoEn: string;
  planSnapshot: GeneratedPlan;
  paradasVisitadas: number[];
  paradasVisitadasIds: string[];
}

export interface GuardarExpedicionResult {
  data: ExpedicionPlanRow | null;
  error: SolicitudPlanServiceError | null;
}
