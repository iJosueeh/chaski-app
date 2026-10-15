/**
 * Hook `usePlanGeneration` — coordinación de la generación de expediciones.
 *
 * Extraído de la pantalla «Buscando planes…»: registra la solicitud,
 * consulta el catálogo, ejecuta el motor y entrega el resultado. La
 * navegación, la rotación de mensajes y el copy de error permanecen en la
 * pantalla (presentación).
 *
 * Orden de operaciones (idéntico al histórico):
 * 1. Sin sesión → 'unauthenticated' (sin llamadas a servicios).
 * 2. En paralelo: registrar la solicitud + consultar el catálogo.
 * 3. Validar la solicitud antes que el catálogo.
 * 4. Notificar el id de solicitud (trazabilidad en el wizard).
 * 5. Ejecutar el motor y asociar `solicitud_id` a cada plan.
 *
 * Idempotencia: la deduplicación de solicitudes vive en
 * `solicitudes-plan.service` (mutex in-flight + caché por huella + reutiliza
 * `request.solicitudId`). Esta capa la conserva llamando al mismo servicio con
 * el mismo `request`, y evita re-ejecuciones innecesarias de la generación
 * cuando `request` solo cambia de identidad por el registro de la solicitud.
 */
import { useEffect, useRef, useState } from 'react';

import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';
import { generarPlanes } from '@/features/plan-engine/plan-engine';
import type { Place } from '@/features/places/interface/places.interface';
import { getActivePlaces } from '@/features/places/services/places.service';
import type { WizardPlanRequest } from '@/features/wizard/context/wizard-context';

import type { GuardarSolicitudPlanResult } from '../interfaces/solicitudes-plan.interface';
import { guardarSolicitudPlanFromWizard } from '../services/solicitudes-plan.service';

/** Clasificación del fallo de generación; el copy lo decide la pantalla. */
export type PlanGenerationErrorKind = 'unauthenticated' | 'solicitud' | 'catalog' | 'unexpected';

export type PlanGenerationSuccess = {
  status: 'success';
  planes: GeneratedPlan[];
  solicitudId: string;
  /** Milisegundos transcurridos desde el inicio del intento. */
  elapsedMs: number;
};

export type PlanGenerationFailure = {
  status: 'error';
  errorKind: PlanGenerationErrorKind;
  /** Detalle adicional (p. ej. el mensaje del servidor al registrar la solicitud). */
  errorDetail: string | null;
};

export type PlanGenerationOutcome = PlanGenerationSuccess | PlanGenerationFailure | { status: 'cancelled' };

/**
 * Huella lógica de una búsqueda: los campos que definen la generación,
 * excluyendo `solicitudId` (cambia de identidad al registrarse la solicitud
 * y no debe re-disparar la generación).
 */
export function getPlanGenerationKey(request: WizardPlanRequest): string {
  return JSON.stringify({
    lat: request.ubicacion?.lat ?? null,
    lng: request.ubicacion?.lng ?? null,
    minutosTotales: request.minutosTotales ?? null,
    horaInicio: request.horaInicio ?? null,
    horaFin: request.horaFin ?? null,
    presupuesto: request.presupuesto ?? null,
    intereses: request.intereses ?? [],
    movilidad: request.movilidad ?? null,
    diaSemana: request.diaSemana ?? null,
    fecha: request.fecha ?? null,
    estrategia: request.estrategia ?? null,
  });
}

/** Dependencias inyectables para poder probar la orquestación real. */
export type PlanGenerationDeps = {
  saveSolicitud: (
    request: WizardPlanRequest,
    userId: string,
  ) => Promise<GuardarSolicitudPlanResult>;
  fetchActivePlaces: () => Promise<{ data: Place[] | null; error: unknown }>;
  generatePlans: (request: WizardPlanRequest, places: Place[]) => GeneratedPlan[];
};

/**
 * Ejecuta un intento completo de generación. Devuelve el resultado
 * clasificado; nunca lanza (los errores quedan clasificados en 'unexpected').
 */
export async function runPlanGeneration(options: {
  request: WizardPlanRequest;
  userId: string | null | undefined;
  onSolicitudSaved?: (solicitudId: string) => void;
  isCancelled?: () => boolean;
} & PlanGenerationDeps): Promise<PlanGenerationOutcome> {
  const t0 = Date.now();
  const { request, userId, saveSolicitud, fetchActivePlaces, generatePlans, onSolicitudSaved } = options;
  const isCancelled = options.isCancelled ?? (() => false);

  try {
    if (!userId) {
      return {
        status: 'error',
        errorKind: 'unauthenticated',
        errorDetail: null,
      };
    }

    // 1+2. Registrar la solicitud y consultar el catálogo en paralelo.
    const [saveResult, placesResult] = await Promise.all([
      saveSolicitud(request, userId),
      fetchActivePlaces(),
    ]);

    if (isCancelled()) {
      return { status: 'cancelled' };
    }

    // 3. Validar primero si hubo error al registrar la solicitud en Supabase.
    if (saveResult.error || !saveResult.data) {
      return {
        status: 'error',
        errorKind: 'solicitud',
        errorDetail: saveResult.error?.message ?? null,
      };
    }

    // Validar si hubo error en el catálogo patrimonial.
    if (placesResult.error || !placesResult.data) {
      return {
        status: 'error',
        errorKind: 'catalog',
        errorDetail: null,
      };
    }

    const solicitudId = saveResult.data.id;
    onSolicitudSaved?.(solicitudId);

    // 4. Ejecutar el motor y asociar el UUID de la solicitud a cada plan.
    const planesGenerados = generatePlans(request, placesResult.data);
    const planes = planesGenerados.map((p) => ({
      ...p,
      solicitud_id: solicitudId,
    }));

    return {
      status: 'success',
      planes,
      solicitudId,
      elapsedMs: Date.now() - t0,
    };
  } catch {
    if (isCancelled()) {
      return { status: 'cancelled' };
    }
    return {
      status: 'error',
      errorKind: 'unexpected',
      errorDetail: null,
    };
  }
}

export type UsePlanGenerationResult = {
  status: 'running' | 'error' | 'success';
  errorKind: PlanGenerationErrorKind | null;
  errorDetail: string | null;
  result: PlanGenerationSuccess | null;
  /** Reinicia el estado y vuelve a ejecutar la generación (reintento). */
  retry: () => void;
};

/** Coordina la generación de un plan y su solicitud con estados encapsulados. */
export function usePlanGeneration(options: {
  request: WizardPlanRequest;
  userId: string | null | undefined;
  /** Notifica el id de solicitud registrado (p. ej. para el contexto del wizard). */
  onSolicitudSaved: (solicitudId: string) => void;
}): UsePlanGenerationResult {
  const [state, setState] = useState<
    | { status: 'running' }
    | PlanGenerationFailure
    | (PlanGenerationSuccess & { status: 'success' })
  >({ status: 'running' });
  const [attempt, setAttempt] = useState(0);

  // Última versión reactiva accesible desde callbacks/efectos sin re-dispararlos.
  const requestRef = useRef(options.request);
  const onSolicitudSavedRef = useRef(options.onSolicitudSaved);
  useEffect(() => {
    requestRef.current = options.request;
    onSolicitudSavedRef.current = options.onSolicitudSaved;
  });

  // Firma del último intento que ya terminó en éxito (evita re-ejecuciones).
  const lastSuccessSignatureRef = useRef<string | null>(null);

  const requestSignature = getPlanGenerationKey(options.request);
  const userId = options.userId;

  useEffect(() => {
    const signature = `${requestSignature}|${userId ?? ''}|${attempt}`;
    // `request` puede cambiar de identidad sin cambiar la búsqueda (p. ej. al
    // registrarse la solicitud): no re-ejecutar un intento ya exitoso.
    if (lastSuccessSignatureRef.current === signature) return;

    let cancelled = false;

    runPlanGeneration({
      request: requestRef.current,
      userId,
      saveSolicitud: (request, id) => guardarSolicitudPlanFromWizard({ request, userId: id }),
      fetchActivePlaces: () => getActivePlaces(),
      generatePlans: (request, places) =>
        generarPlanes(request, places, { strategy: request.estrategia ?? 'BEAM_SEARCH' }),
      onSolicitudSaved: (id) => onSolicitudSavedRef.current(id),
      isCancelled: () => cancelled,
    }).then((outcome) => {
      if (cancelled) return;

      if (outcome.status === 'success') {
        lastSuccessSignatureRef.current = signature;
        setState({
          status: 'success',
          planes: outcome.planes,
          solicitudId: outcome.solicitudId,
          elapsedMs: outcome.elapsedMs,
        });
      } else if (outcome.status === 'error') {
        setState({
          status: 'error',
          errorKind: outcome.errorKind,
          errorDetail: outcome.errorDetail,
        });
      }
      // 'cancelled': el resultado de un intento descartado no toca el estado.
    });

    return () => {
      cancelled = true;
    };
  }, [requestSignature, userId, attempt]);

  const retry = () => {
    setState({ status: 'running' });
    setAttempt((c) => c + 1);
  };

  return {
    status: state.status,
    errorKind: state.status === 'error' ? state.errorKind : null,
    errorDetail: state.status === 'error' ? state.errorDetail : null,
    result: state.status === 'success' ? state : null,
    retry,
  };
}
