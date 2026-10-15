import { describe, expect, it, vi } from 'vitest';

import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';
import type { WizardPlanRequest } from '@/features/wizard/context/wizard-context';

import type { GuardarSolicitudPlanResult } from '../interfaces/solicitudes-plan.interface';
import {
  getPlanGenerationKey,
  runPlanGeneration,
  type PlanGenerationDeps,
} from '../hooks/use-plan-generation';

// Corta la cadena supabase → async-storage → react-native (no soportado en node).
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function makeRequest(extra?: Partial<WizardPlanRequest>): WizardPlanRequest {
  return {
    ubicacion: { modo: 'gps', nombre: 'Parque Kennedy', lat: -12.12, lng: -77.03 },
    minutosTotales: 240,
    horaInicio: '09:00',
    horaFin: '13:00',
    presupuesto: 40,
    intereses: ['cultura'],
    movilidad: 'caminando',
    solicitudId: null,
    ...extra,
  };
}

function makeGeneratedPlan(id: string): GeneratedPlan {
  return {
    id,
    titulo: 'Ruta Centro Histórico',
    descripcion: 'Expedición Serie AX',
    variante: 'equilibrado',
    paradas: [],
    duracion_total_min: 240,
    costo_total: 30,
    distancia_km_aprox: 3.2,
  };
}

const solicitudOk = { data: { id: 'solicitud-1' }, error: null } as unknown as GuardarSolicitudPlanResult;

function makeDeps(overrides?: Partial<PlanGenerationDeps> & {
  onSolicitudSaved?: (id: string) => void;
}) {
  const saveSolicitud = vi.fn().mockResolvedValue(solicitudOk);
  const fetchActivePlaces = vi.fn().mockResolvedValue({ data: [], error: null });
  const generatePlans = vi.fn().mockReturnValue([makeGeneratedPlan('plan-1')]);
  return {
    saveSolicitud,
    fetchActivePlaces,
    generatePlans,
    onSolicitudSaved: overrides?.onSolicitudSaved,
    deps: {
      saveSolicitud: overrides?.saveSolicitud ?? saveSolicitud,
      fetchActivePlaces: overrides?.fetchActivePlaces ?? fetchActivePlaces,
      generatePlans: overrides?.generatePlans ?? generatePlans,
    } as PlanGenerationDeps,
    spies: { saveSolicitud, fetchActivePlaces, generatePlans },
  };
}

describe('use-plan-generation — orquestación real (Serie AX)', () => {
  describe('runPlanGeneration — caso de éxito', () => {
    it('registra la solicitud, consulta el catálogo y devuelve los planes trazados', async () => {
      const request = makeRequest();
      const onSolicitudSaved = vi.fn();
      const { deps, spies } = makeDeps({ onSolicitudSaved });

      const outcome = await runPlanGeneration({
        request,
        userId: 'user-1',
        onSolicitudSaved,
        ...deps,
      });

      expect(outcome.status).toBe('success');
      if (outcome.status !== 'success') return;

      // Identificador de solicitud conservado y notificado al wizard.
      expect(outcome.solicitudId).toBe('solicitud-1');
      expect(onSolicitudSaved).toHaveBeenCalledTimes(1);
      expect(onSolicitudSaved).toHaveBeenCalledWith('solicitud-1');

      // Cada plan queda asociado a la solicitud para trazabilidad.
      expect(outcome.planes).toHaveLength(1);
      expect(outcome.planes[0]).toMatchObject({ id: 'plan-1', solicitud_id: 'solicitud-1' });

      expect(outcome.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(spies.saveSolicitud).toHaveBeenCalledTimes(1);
      expect(spies.saveSolicitud).toHaveBeenCalledWith(request, 'user-1');
      expect(spies.fetchActivePlaces).toHaveBeenCalledTimes(1);
    });

    it('reutiliza el id existente cuando el servicio devuelve la solicitud ya registrada', async () => {
      // El servicio reutiliza request.solicitudId sin insertar de nuevo.
      const existing = { data: { id: 'solicitud-previa' }, error: null } as unknown as GuardarSolicitudPlanResult;
      const { deps } = makeDeps({ saveSolicitud: vi.fn().mockResolvedValue(existing) });

      const outcome = await runPlanGeneration({
        request: makeRequest({ solicitudId: 'solicitud-previa' }),
        userId: 'user-1',
        ...deps,
      });

      expect(outcome.status).toBe('success');
      if (outcome.status !== 'success') return;
      expect(outcome.solicitudId).toBe('solicitud-previa');
      expect(outcome.planes[0].solicitud_id).toBe('solicitud-previa');
    });
  });

  describe('runPlanGeneration — errores', () => {
    it('sin sesión no llama a ningún servicio', async () => {
      const { deps, spies } = makeDeps();

      const outcome = await runPlanGeneration({
        request: makeRequest(),
        userId: undefined,
        ...deps,
      });

      expect(outcome).toEqual({
        status: 'error',
        errorKind: 'unauthenticated',
        errorDetail: null,
      });
      expect(spies.saveSolicitud).not.toHaveBeenCalled();
      expect(spies.fetchActivePlaces).not.toHaveBeenCalled();
      expect(spies.generatePlans).not.toHaveBeenCalled();
    });

    it('clasifica el fallo de la solicitud con el detalle del servidor', async () => {
      const failing = {
        data: null,
        error: { message: 'RLS: no tienes permisos' },
      } as unknown as GuardarSolicitudPlanResult;
      const { deps, spies } = makeDeps({ saveSolicitud: vi.fn().mockResolvedValue(failing) });

      const outcome = await runPlanGeneration({
        request: makeRequest(),
        userId: 'user-1',
        ...deps,
      });

      expect(outcome).toEqual({
        status: 'error',
        errorKind: 'solicitud',
        errorDetail: 'RLS: no tienes permisos',
      });
      expect(spies.generatePlans).not.toHaveBeenCalled();
    });

    it('sin detalle del servidor usa errorDetail nulo (la pantalla aplica su copy)', async () => {
      const failing = { data: null, error: null } as unknown as GuardarSolicitudPlanResult;
      const { deps } = makeDeps({ saveSolicitud: vi.fn().mockResolvedValue(failing) });

      const outcome = await runPlanGeneration({
        request: makeRequest(),
        userId: 'user-1',
        ...deps,
      });

      expect(outcome).toEqual({
        status: 'error',
        errorKind: 'solicitud',
        errorDetail: null,
      });
    });

    it('si fallan solicitud y catálogo, prevalece el error de solicitud (orden de validación)', async () => {
      const failing = { data: null, error: null } as unknown as GuardarSolicitudPlanResult;
      const { deps } = makeDeps({
        saveSolicitud: vi.fn().mockResolvedValue(failing),
        fetchActivePlaces: vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } }),
      });

      const outcome = await runPlanGeneration({
        request: makeRequest(),
        userId: 'user-1',
        ...deps,
      });

      expect(outcome).toMatchObject({ status: 'error', errorKind: 'solicitud' });
    });

    it('clasifica el fallo del catálogo sin ejecutar el motor', async () => {
      const { deps, spies } = makeDeps({
        fetchActivePlaces: vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } }),
      });

      const outcome = await runPlanGeneration({
        request: makeRequest(),
        userId: 'user-1',
        ...deps,
      });

      expect(outcome).toEqual({
        status: 'error',
        errorKind: 'catalog',
        errorDetail: null,
      });
      expect(spies.generatePlans).not.toHaveBeenCalled();
    });

    it('clasifica como «unexpected» cualquier excepción, incluida la del motor', async () => {
      const { deps } = makeDeps({
        generatePlans: vi.fn().mockImplementation(() => {
          throw new Error('el motor falló');
        }),
      });

      const outcome = await runPlanGeneration({
        request: makeRequest(),
        userId: 'user-1',
        ...deps,
      });

      expect(outcome).toEqual({
        status: 'error',
        errorKind: 'unexpected',
        errorDetail: null,
      });
    });
  });

  describe('runPlanGeneration — descarte de intentos cancelados', () => {
    it('devuelve «cancelled» y no ejecuta el motor si el intento fue descartado', async () => {
      let cancelled = false;
      const { deps, spies } = makeDeps({
        saveSolicitud: vi.fn().mockImplementation(async () => {
          cancelled = true; // p. ej. el componente se desmontó durante la espera
          return solicitudOk;
        }),
      });

      const outcome = await runPlanGeneration({
        request: makeRequest(),
        userId: 'user-1',
        isCancelled: () => cancelled,
        ...deps,
      });

      expect(outcome).toEqual({ status: 'cancelled' });
      expect(spies.generatePlans).not.toHaveBeenCalled();
    });
  });

  describe('getPlanGenerationKey — prevención de ejecuciones duplicadas', () => {
    it('es estable cuando solo cambia solicitudId (registro de la solicitud no re-dispara)', () => {
      const before = makeRequest({ solicitudId: null });
      const after = makeRequest({ solicitudId: 'solicitud-1' });

      expect(getPlanGenerationKey(after)).toBe(getPlanGenerationKey(before));
    });

    it('es estable ante recreaciones del objeto con los mismos valores', () => {
      expect(getPlanGenerationKey(makeRequest())).toBe(getPlanGenerationKey(makeRequest()));
    });

    it('cambia cuando cambia un campo que define la búsqueda', () => {
      const base = getPlanGenerationKey(makeRequest());

      expect(getPlanGenerationKey(makeRequest({ minutosTotales: 120 }))).not.toBe(base);
      expect(getPlanGenerationKey(makeRequest({ horaInicio: '14:00' }))).not.toBe(base);
      expect(getPlanGenerationKey(makeRequest({ presupuesto: 80 }))).not.toBe(base);
      expect(getPlanGenerationKey(makeRequest({ intereses: ['gastro'] }))).not.toBe(base);
      expect(getPlanGenerationKey(makeRequest({ movilidad: 'aplicativo' }))).not.toBe(base);
      expect(getPlanGenerationKey(makeRequest({ estrategia: 'GREEDY' }))).not.toBe(base);
      expect(
        getPlanGenerationKey(
          makeRequest({ ubicacion: { modo: 'gps', nombre: 'Barranco', lat: -12.14, lng: -77.02 } }),
        ),
      ).not.toBe(base);
    });
  });
});
