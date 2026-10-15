import { supabase } from '@/lib/supabase';

import type {
  ExpedicionPlanRow,
  GuardarExpedicionInput,
  GuardarExpedicionResult,
} from '../interfaces/expediciones-plan.interface';
import { parseSupabaseError } from './solicitudes-plan.service';

function validarInputExpedicion(input: GuardarExpedicionInput): GuardarExpedicionResult['error'] {
  if (!input.usuarioId || input.usuarioId.trim() === '') {
    return {
      type: 'AUTH_REQUIRED',
      message: 'Se requiere una sesión de usuario activa para registrar la expedición.',
    };
  }

  if (!input.solicitudId || input.solicitudId.trim() === '') {
    return {
      type: 'VALIDATION_ERROR',
      message: 'La expedición debe estar asociada a una solicitud de planificación.',
    };
  }

  return null;
}

export async function guardarExpedicion(
  input: GuardarExpedicionInput,
  client: typeof supabase = supabase,
): Promise<GuardarExpedicionResult> {
  const validationError = validarInputExpedicion(input);
  if (validationError) {
    return { data: null, error: validationError };
  }

  try {
    const rowToUpsert = {
      solicitud_id: input.solicitudId,
      usuario_id: input.usuarioId,
      estado_expedicion: input.estadoExpedicion,
      completado_en: input.completadoEn,
      plan_snapshot: input.planSnapshot,
      paradas_visitadas: input.paradasVisitadas,
      paradas_visitadas_ids: input.paradasVisitadasIds,
    };

    const { data, error } = await client
      .from('expediciones_plan')
      .upsert(rowToUpsert, { onConflict: 'solicitud_id' })
      .select()
      .single();

    if (error || !data) {
      return { data: null, error: parseSupabaseError(error) };
    }

    return { data: data as ExpedicionPlanRow, error: null };
  } catch (err) {
    return { data: null, error: parseSupabaseError(err) };
  }
}
