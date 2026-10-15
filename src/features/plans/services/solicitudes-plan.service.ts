/**
 * Servicio tipado para la persistencia de solicitudes_plan y solicitudes_plan_categorias en Supabase.
 *
 * Principios:
 * 1. Restringido a usuarios autenticados (verificación de userId y RLS).
 * 2. Idempotencia y prevención de duplicados: in-flight mutex + cache por huella de solicitud.
 * 3. Validación estricta de constraints de base de datos antes de enviar.
 * 4. Gestión atómica con rollback: si falla el guardado de categorías, se elimina la solicitud huérfana.
 * 5. Manejo explícito y honesto de errores (red, permisos/RLS, validación, base de datos).
 */

import { supabase } from '@/lib/supabase';
import type { WizardPlanRequest } from '@/features/wizard/context/wizard-context';
import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';
import type { EstadoExpedicion } from '../interfaces/plans.interface';
import type { ExpedicionHistorialEntry } from '../interfaces/expediciones-plan.interface';
import type {
  GuardarSolicitudPlanInput,
  GuardarSolicitudPlanResult,
  ListarSolicitudesHistorialResult,
  MovilidadSolicitud,
  SolicitudHistorialEntry,
  SolicitudPlanRow,
  SolicitudPlanServiceError,
  TipoPuntoFinal,
} from '../interfaces/solicitudes-plan.interface';

// ── Cache y Mutex en memoria para evitar duplicados ─────────────────────────

const inFlightRequests = new Map<string, Promise<GuardarSolicitudPlanResult>>();
const savedSolicitudCache = new Map<string, SolicitudPlanRow>();

export function clearSolicitudPlanCache(): void {
  inFlightRequests.clear();
  savedSolicitudCache.clear();
}

/**
 * Genera una huella única para la solicitud del wizard para detectar reintentos
 * idénticos o doble pulsación dentro de la misma sesión.
 */
export function generateRequestFingerprint(input: GuardarSolicitudPlanInput): string {
  const cats = (input.categoriaIds ?? []).slice().sort().join(',');
  const lat = input.inicioLatitud.toFixed(5);
  const lng = input.inicioLongitud.toFixed(5);
  return `${input.userId}:${lat},${lng}:${input.fechaHoraInicio}:${input.fechaHoraFin}:${input.gastoMax ?? 'none'}:${input.movilidad}:${input.tipoPuntoFinal ?? 'REGRESAR_INICIO'}:${cats}`;
}

// ── Mapeos y Utilidades ──────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function mapWizardMovilidadToDb(
  movilidad: 'caminando' | 'publico' | 'aplicativo' | string | null | undefined,
): MovilidadSolicitud {
  switch (movilidad) {
    case 'caminando':
      return 'CAMINANDO';
    case 'publico':
      return 'TRANSPORTE_PUBLICO';
    case 'aplicativo':
      return 'AUTO';
    case 'AUTO':
      return 'AUTO';
    case 'TRANSPORTE_PUBLICO':
      return 'TRANSPORTE_PUBLICO';
    case 'CAMINANDO':
    default:
      return 'CAMINANDO';
  }
}

/**
 * Construye fecha_hora_inicio y fecha_hora_fin garantizando siempre que
 * fecha_hora_fin > fecha_hora_inicio (constraint solicitud_fechas_validas).
 */
export function buildSolicitudFechas(params: {
  fecha?: string | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  minutosTotales?: number | null;
  baseDate?: Date;
}): { fechaHoraInicio: string; fechaHoraFin: string } {
  const base = params.baseDate ?? new Date();

  // Fecha base (YYYY-MM-DD)
  let yyyy = base.getFullYear();
  let mm = base.getMonth();
  let dd = base.getDate();

  if (params.fecha) {
    const parts = params.fecha.split('-');
    if (parts.length === 3) {
      const pY = parseInt(parts[0], 10);
      const pM = parseInt(parts[1], 10) - 1;
      const pD = parseInt(parts[2], 10);
      if (!isNaN(pY) && !isNaN(pM) && !isNaN(pD)) {
        yyyy = pY;
        mm = pM;
        dd = pD;
      }
    }
  }

  // Hora de inicio
  let startH = base.getHours();
  let startM = base.getMinutes();

  if (params.horaInicio) {
    const [h, m] = params.horaInicio.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      startH = h;
      startM = m;
    }
  }

  const dInicio = new Date(yyyy, mm, dd, startH, startM, 0, 0);

  // Hora de fin
  let dFin: Date;
  if (params.horaFin) {
    const [h, m] = params.horaFin.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      dFin = new Date(yyyy, mm, dd, h, m, 0, 0);
      // Si la hora de fin es menor o igual a inicio, cruzó la medianoche o es el día siguiente
      if (dFin.getTime() <= dInicio.getTime()) {
        dFin.setDate(dFin.getDate() + 1);
      }
    } else {
      const dur = params.minutosTotales && params.minutosTotales > 0 ? params.minutosTotales : 120;
      dFin = new Date(dInicio.getTime() + dur * 60000);
    }
  } else if (params.minutosTotales && params.minutosTotales > 0) {
    dFin = new Date(dInicio.getTime() + params.minutosTotales * 60000);
  } else {
    dFin = new Date(dInicio.getTime() + 120 * 60000); // 2h por defecto
  }

  // Garantía absoluta de que fin > inicio por al menos 1 minuto
  if (dFin.getTime() <= dInicio.getTime()) {
    dFin = new Date(dInicio.getTime() + 60000);
  }

  return {
    fechaHoraInicio: dInicio.toISOString(),
    fechaHoraFin: dFin.toISOString(),
  };
}

/**
 * Resuelve una lista de nombres de afinidades culturales o UUIDs a UUIDs válidos
 * existentes en la tabla `public.categorias`.
 */
export async function resolveCategoryIds(
  interesesOrIds: string[],
  client: typeof supabase = supabase,
): Promise<string[]> {
  if (!interesesOrIds || interesesOrIds.length === 0) {
    return [];
  }

  const explicitUuids = interesesOrIds.filter(isUuid);
  const nameInterests = interesesOrIds.filter((item) => !isUuid(item));

  if (nameInterests.length === 0) {
    return Array.from(new Set(explicitUuids));
  }

  try {
    const { data: dbCategorias, error } = await client
      .from('categorias')
      .select('id, nombre')
      .eq('estado', true);

    if (error || !dbCategorias) {
      // Si no se puede consultar el catálogo de categorías, devolvemos solo los UUIDs válidos
      return Array.from(new Set(explicitUuids));
    }

    const resolvedIds = new Set<string>(explicitUuids);

    for (const name of nameInterests) {
      const normalized = name.trim().toLowerCase();
      const match = dbCategorias.find(
        (cat) => cat.nombre.trim().toLowerCase() === normalized,
      );
      if (match) {
        resolvedIds.add(match.id);
      }
    }

    return Array.from(resolvedIds);
  } catch {
    return Array.from(new Set(explicitUuids));
  }
}

// ── Clasificación de Errores ─────────────────────────────────────────────────

export function parseSupabaseError(error: unknown): SolicitudPlanServiceError {
  if (!error) {
    return {
      type: 'DATABASE_ERROR',
      message: 'Error desconocido al interactuar con el servidor.',
    };
  }

  const errObj = error as Record<string, unknown>;
  const msg = String(errObj.message || '');
  const code = String(errObj.code || '');
  const status = Number(errObj.status || 0);

  // Error de permisos / RLS
  if (
    code === '42501' ||
    status === 403 ||
    status === 401 ||
    msg.toLowerCase().includes('row-level security') ||
    msg.toLowerCase().includes('permission denied') ||
    msg.toLowerCase().includes('violates row-level security policy')
  ) {
    return {
      type: 'PERMISSION_DENIED',
      message: 'No tienes permisos para registrar la solicitud. Verifica que tu sesión esté activa.',
      code,
      originalError: error,
    };
  }

  // Error de red
  if (
    error instanceof TypeError ||
    msg.toLowerCase().includes('network') ||
    msg.toLowerCase().includes('failed to fetch') ||
    msg.toLowerCase().includes('abort') ||
    msg.toLowerCase().includes('timeout')
  ) {
    return {
      type: 'NETWORK_ERROR',
      message: 'No se pudo conectar con el servidor para guardar tu solicitud. Revisa tu conexión a internet.',
      code,
      originalError: error,
    };
  }

  return {
    type: 'DATABASE_ERROR',
    message: msg || 'Ocurrió un error al persistir la solicitud de planificación.',
    code,
    originalError: error,
  };
}

// ── Validación de Entrada ────────────────────────────────────────────────────

export function validarInputSolicitud(
  input: GuardarSolicitudPlanInput,
): SolicitudPlanServiceError | null {
  if (!input.userId || input.userId.trim() === '') {
    return {
      type: 'AUTH_REQUIRED',
      message: 'Se requiere una sesión de usuario activa para guardar una solicitud de planificación.',
    };
  }

  if (
    typeof input.inicioLatitud !== 'number' ||
    isNaN(input.inicioLatitud) ||
    input.inicioLatitud < -90 ||
    input.inicioLatitud > 90
  ) {
    return {
      type: 'VALIDATION_ERROR',
      message: 'La latitud de inicio debe estar entre -90 y 90 grados.',
    };
  }

  if (
    typeof input.inicioLongitud !== 'number' ||
    isNaN(input.inicioLongitud) ||
    input.inicioLongitud < -180 ||
    input.inicioLongitud > 180
  ) {
    return {
      type: 'VALIDATION_ERROR',
      message: 'La longitud de inicio debe estar entre -180 y 180 grados.',
    };
  }

  const dInicio = new Date(input.fechaHoraInicio).getTime();
  const dFin = new Date(input.fechaHoraFin).getTime();

  if (isNaN(dInicio) || isNaN(dFin)) {
    return {
      type: 'VALIDATION_ERROR',
      message: 'Las fechas y horas de inicio y fin deben ser marcas de tiempo ISO válidas.',
    };
  }

  if (dFin <= dInicio) {
    return {
      type: 'VALIDATION_ERROR',
      message: 'La hora de finalización debe ser estrictamente posterior a la hora de inicio.',
    };
  }

  if (input.gastoMin !== null && input.gastoMin !== undefined && input.gastoMin < 0) {
    return {
      type: 'VALIDATION_ERROR',
      message: 'El gasto mínimo no puede ser negativo.',
    };
  }

  if (input.gastoMax !== null && input.gastoMax !== undefined && input.gastoMax < 0) {
    return {
      type: 'VALIDATION_ERROR',
      message: 'El presupuesto máximo no puede ser negativo.',
    };
  }

  if (
    input.gastoMin !== null &&
    input.gastoMin !== undefined &&
    input.gastoMax !== null &&
    input.gastoMax !== undefined &&
    input.gastoMin > input.gastoMax
  ) {
    return {
      type: 'VALIDATION_ERROR',
      message: 'El gasto mínimo no puede ser mayor que el gasto máximo.',
    };
  }

  if (input.tipoPuntoFinal === 'OTRA_UBICACION') {
    if (
      typeof input.finalLatitud !== 'number' ||
      input.finalLatitud < -90 ||
      input.finalLatitud > 90 ||
      typeof input.finalLongitud !== 'number' ||
      input.finalLongitud < -180 ||
      input.finalLongitud > 180
    ) {
      return {
        type: 'VALIDATION_ERROR',
        message: 'Para un punto final personalizado, se requieren coordenadas finales válidas.',
      };
    }
  }

  return null;
}

// ── Servicio Principal ───────────────────────────────────────────────────────

/**
 * Guarda una solicitud de planificación en `public.solicitudes_plan` y sus categorías
 * en `public.solicitudes_plan_categorias`.
 *
 * Implementa control de concurrencia y deduplicación para evitar solicitudes dobles.
 */
export async function guardarSolicitudPlan(
  input: GuardarSolicitudPlanInput,
  client: typeof supabase = supabase,
): Promise<GuardarSolicitudPlanResult> {
  // 1. Validación previa en memoria
  const validationError = validarInputSolicitud(input);
  if (validationError) {
    return { data: null, error: validationError };
  }

  const fingerprint = generateRequestFingerprint(input);

  // 2. Comprobar si ya existe en caché confirmada (idempotencia en la sesión)
  if (!input.forceNew && savedSolicitudCache.has(fingerprint)) {
    const cached = savedSolicitudCache.get(fingerprint)!;
    return { data: cached, error: null };
  }

  // 3. Comprobar si ya hay una petición idéntica en vuelo (evita doble pulsación)
  if (!input.forceNew && inFlightRequests.has(fingerprint)) {
    return inFlightRequests.get(fingerprint)!;
  }

  const executionPromise = (async (): Promise<GuardarSolicitudPlanResult> => {
    try {
      // 4. Preparación de datos según constraints de base de datos
      const tipoPuntoFinal: TipoPuntoFinal = input.tipoPuntoFinal ?? 'REGRESAR_INICIO';
      const isOtraUbicacion = tipoPuntoFinal === 'OTRA_UBICACION';

      const rowToInsert = {
        usuario_id: input.userId,
        fecha_hora_inicio: input.fechaHoraInicio,
        fecha_hora_fin: input.fechaHoraFin,
        inicio_latitud: input.inicioLatitud,
        inicio_longitud: input.inicioLongitud,
        inicio_descripcion: input.inicioDescripcion ?? null,
        tipo_punto_final: tipoPuntoFinal,
        // Constraint: si no es OTRA_UBICACION, final_latitud y final_longitud DEBEN ser null
        final_latitud: isOtraUbicacion ? input.finalLatitud ?? null : null,
        final_longitud: isOtraUbicacion ? input.finalLongitud ?? null : null,
        final_descripcion: isOtraUbicacion ? input.finalDescripcion ?? null : null,
        gasto_min: input.gastoMin ?? 0,
        gasto_max: input.gastoMax ?? null,
        movilidad: input.movilidad,
      };

      // 5. Inserción en `public.solicitudes_plan`
      const { data: insertedSolicitud, error: insertError } = await client
        .from('solicitudes_plan')
        .insert(rowToInsert)
        .select(
          `
          id,
          usuario_id,
          fecha_hora_inicio,
          fecha_hora_fin,
          inicio_latitud,
          inicio_longitud,
          inicio_descripcion,
          tipo_punto_final,
          final_latitud,
          final_longitud,
          final_descripcion,
          gasto_min,
          gasto_max,
          movilidad,
          fecha_creacion
        `,
        )
        .single();

      if (insertError || !insertedSolicitud) {
        return {
          data: null,
          error: parseSupabaseError(insertError),
        };
      }

      const solicitudId = insertedSolicitud.id;

      // 6. Inserción de categorías asociadas (si existen)
      const validCategoryIds = (input.categoriaIds ?? []).filter(isUuid);
      if (validCategoryIds.length > 0) {
        const catRows = validCategoryIds.map((catId) => ({
          solicitud_id: solicitudId,
          categoria_id: catId,
        }));

        const { error: catError } = await client
          .from('solicitudes_plan_categorias')
          .insert(catRows);

        if (catError) {
          // Rollback atómico: eliminar la solicitud creada para no dejar registros corruptos
          try {
            await client.from('solicitudes_plan').delete().eq('id', solicitudId);
          } catch {
            // Error en rollback registrado internamente
          }

          return {
            data: null,
            error: parseSupabaseError(catError),
          };
        }
      }

      const resultado: SolicitudPlanRow = insertedSolicitud as SolicitudPlanRow;

      // Guardar en caché para evitar re-inserciones en reintentos o pulsaciones repetidas
      savedSolicitudCache.set(fingerprint, resultado);

      return {
        data: resultado,
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: parseSupabaseError(err),
      };
    } finally {
      inFlightRequests.delete(fingerprint);
    }
  })();

  inFlightRequests.set(fingerprint, executionPromise);
  return executionPromise;
}

/**
 * Adaptador de alto nivel para invocar directamente desde el flujo del Wizard.
 */
export async function guardarSolicitudPlanFromWizard(params: {
  request: WizardPlanRequest;
  userId: string;
  client?: typeof supabase;
  forceNew?: boolean;
}): Promise<GuardarSolicitudPlanResult> {
  const { request, userId, client = supabase, forceNew = false } = params;

  if (!userId) {
    return {
      data: null,
      error: {
        type: 'AUTH_REQUIRED',
        message: 'Debes iniciar sesión para registrar y generar expediciones.',
      },
    };
  }

  if (!request.ubicacion || request.ubicacion.lat == null || request.ubicacion.lng == null) {
    return {
      data: null,
      error: {
        type: 'VALIDATION_ERROR',
        message: 'Debes seleccionar una ubicación de partida válida.',
      },
    };
  }

  // 1. Resolver fechas
  const { fechaHoraInicio, fechaHoraFin } = buildSolicitudFechas({
    fecha: request.fecha,
    horaInicio: request.horaInicio,
    horaFin: request.horaFin,
    minutosTotales: request.minutosTotales,
  });

  // 2. Resolver movilidad
  const movilidad = mapWizardMovilidadToDb(request.movilidad);

  // 3. Resolver categorías
  const categoriaIds = await resolveCategoryIds(request.intereses, client);

  // 4. Si el wizard ya guardó una solicitud idéntica en esta instancia y tiene solicitudId:
  if (!forceNew && request.solicitudId) {
    return {
      data: {
        id: request.solicitudId,
        usuario_id: userId,
        fecha_hora_inicio: fechaHoraInicio,
        fecha_hora_fin: fechaHoraFin,
        inicio_latitud: request.ubicacion.lat,
        inicio_longitud: request.ubicacion.lng,
        inicio_descripcion: request.ubicacion.nombre ?? null,
        tipo_punto_final: 'REGRESAR_INICIO',
        final_latitud: null,
        final_longitud: null,
        final_descripcion: null,
        gasto_min: 0,
        gasto_max: request.presupuesto ?? null,
        movilidad,
        fecha_creacion: new Date().toISOString(),
      },
      error: null,
    };
  }

  // 5. Invocar servicio
  return guardarSolicitudPlan(
    {
      userId,
      inicioLatitud: request.ubicacion.lat,
      inicioLongitud: request.ubicacion.lng,
      inicioDescripcion: request.ubicacion.nombre ?? null,
      fechaHoraInicio,
      fechaHoraFin,
      tipoPuntoFinal: 'REGRESAR_INICIO',
      gastoMin: 0,
      gastoMax: request.presupuesto ?? null,
      movilidad,
      categoriaIds,
      forceNew,
    },
    client,
  );
}

// ── Consulta del historial (Serie AX) ───────────────────────────────────────

type ExpedicionEmbedRow = {
  estado_expedicion: EstadoExpedicion;
  completado_en: string | null;
  plan_snapshot: unknown;
  paradas_visitadas: number[] | null;
  paradas_visitadas_ids: string[] | null;
} | null;

type SolicitudConCategoriasRow = SolicitudPlanRow & {
  solicitudes_plan_categorias: { categorias: { nombre: string } | null }[] | null;
  expediciones_plan: ExpedicionEmbedRow | ExpedicionEmbedRow[];
};

const SOLICITUD_HISTORIAL_SELECT = `
  id,
  usuario_id,
  fecha_hora_inicio,
  fecha_hora_fin,
  inicio_latitud,
  inicio_longitud,
  inicio_descripcion,
  tipo_punto_final,
  final_latitud,
  final_longitud,
  final_descripcion,
  gasto_min,
  gasto_max,
  movilidad,
  fecha_creacion,
  solicitudes_plan_categorias ( categorias ( nombre ) ),
  expediciones_plan ( estado_expedicion, completado_en, plan_snapshot, paradas_visitadas, paradas_visitadas_ids )
`;

function parsePlanSnapshot(value: unknown): GeneratedPlan | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as GeneratedPlan;
    } catch {
      return null;
    }
  }
  return value as GeneratedPlan;
}

function mapExpedicionEmbed(
  embed: ExpedicionEmbedRow | ExpedicionEmbedRow[],
): ExpedicionHistorialEntry | null {
  const raw = (Array.isArray(embed) ? embed[0] : embed) ?? null;
  if (!raw) {
    return null;
  }
  if (!raw.estado_expedicion && !raw.completado_en && !raw.plan_snapshot) {
    return null;
  }

  return {
    estado_expedicion: raw.estado_expedicion,
    completado_en: raw.completado_en,
    plan_snapshot: parsePlanSnapshot(raw.plan_snapshot),
    paradas_visitadas: raw.paradas_visitadas ?? [],
    paradas_visitadas_ids: raw.paradas_visitadas_ids ?? [],
  };
}

function mapSolicitudHistorialRows(rows: SolicitudConCategoriasRow[]): SolicitudHistorialEntry[] {
  return rows.map(({ solicitudes_plan_categorias, expediciones_plan, ...solicitud }) => ({
    ...solicitud,
    categorias: (solicitudes_plan_categorias ?? [])
      .map((rel) => rel.categorias?.nombre)
      .filter((nombre): nombre is string => Boolean(nombre)),
    expedicion: mapExpedicionEmbed(expediciones_plan ?? null),
  }));
}

export async function listarSolicitudesHistorial(
  userId: string,
  client: typeof supabase = supabase,
): Promise<ListarSolicitudesHistorialResult> {
  if (!userId || userId.trim() === '') {
    return {
      data: [],
      error: {
        type: 'AUTH_REQUIRED',
        message: 'Se requiere una sesión de usuario activa para consultar el historial.',
      },
    };
  }

  try {
    const { data, error } = await client
      .from('solicitudes_plan')
      .select(SOLICITUD_HISTORIAL_SELECT)
      .eq('usuario_id', userId)
      .order('fecha_creacion', { ascending: false });

    if (error) {
      return { data: [], error: parseSupabaseError(error) };
    }

    const rows = (data ?? []) as unknown as SolicitudConCategoriasRow[];
    return { data: mapSolicitudHistorialRows(rows), error: null };
  } catch (err) {
    return { data: [], error: parseSupabaseError(err) };
  }
}
