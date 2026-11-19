-- ============================================================================
-- MIGRACIÓN CHASKI: Reportes y Estadísticas Administrativas (RF20 / CU09)
-- Archivo: supabase/migrations/20261119100000_admin_reports.sql
-- ============================================================================
-- Propósito:
--   1. Añade índice sobre solicitudes_plan (fecha_creacion DESC) para acelerar
--      los filtros temporales del panel administrativo.
--   2. Implementa la función RPC admin_get_reports con agregaciones directas
--      en PostgreSQL, soporte de rangos temporales ('7d', '30d', '90d', 'todo',
--      'personalizado'), evolución temporal sin producto cartesiano, rankings
--      de categorías y destinos (incluidos y visitados), y validación de seguridad.
--
-- Es idempotente: se puede ejecutar varias veces sin alterar esquemas ni borrar datos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Índice para optimizar rangos de fecha en solicitudes_plan
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS solicitudes_plan_fecha_creacion_idx
  ON public.solicitudes_plan (fecha_creacion DESC);

-- ----------------------------------------------------------------------------
-- 2. Función RPC para reportes administrativos (RF20)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_reports(
  p_periodo text DEFAULT '30d',
  p_desde timestamptz DEFAULT NULL,
  p_hasta timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_desde timestamptz;
  v_hasta timestamptz;
  v_agrupacion text;

  -- Totales y KPIs
  v_solicitudes_total bigint := 0;
  v_expediciones_total bigint := 0;
  v_expediciones_completadas bigint := 0;
  v_expediciones_parciales bigint := 0;
  v_expediciones_abandonadas bigint := 0;
  v_solicitudes_con_expedicion bigint := 0;
  v_paradas_visitadas_total bigint := 0;
  v_tasa_finalizacion numeric(5,2) := 0;
  v_tasa_conversion numeric(5,2) := 0;

  -- Agregaciones JSONB
  v_categorias_ranking jsonb := '[]'::jsonb;
  v_destinos_incluidos_ranking jsonb := '[]'::jsonb;
  v_destinos_visitados_ranking jsonb := '[]'::jsonb;
  v_evolucion jsonb := '[]'::jsonb;
BEGIN
  -- --------------------------------------------------------------------------
  -- A. Validación de autorización de administrador
  -- --------------------------------------------------------------------------
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  -- --------------------------------------------------------------------------
  -- B. Validación de parámetros de período y fechas
  -- --------------------------------------------------------------------------
  IF p_periodo NOT IN ('7d', '30d', '90d', 'todo', 'personalizado') THEN
    RAISE EXCEPTION 'PARAM_INVALID: Periodo no valido. Opciones: 7d, 30d, 90d, todo, personalizado'
      USING ERRCODE = '22023';
  END IF;

  IF p_periodo = 'personalizado' THEN
    IF p_desde IS NULL OR p_hasta IS NULL THEN
      RAISE EXCEPTION 'PARAM_INVALID: Se requieren p_desde y p_hasta para periodo personalizado'
        USING ERRCODE = '22023';
    END IF;

    IF p_desde > p_hasta THEN
      RAISE EXCEPTION 'PARAM_INVALID: p_desde no puede ser posterior a p_hasta'
        USING ERRCODE = '22023';
    END IF;

    IF p_hasta > now() + interval '1 day' THEN
      RAISE EXCEPTION 'PARAM_INVALID: p_hasta no puede estar en el futuro'
        USING ERRCODE = '22023';
    END IF;

    IF p_hasta - p_desde > interval '5 years' THEN
      RAISE EXCEPTION 'PARAM_INVALID: El rango personalizado no puede superar los 5 anos'
        USING ERRCODE = '22023';
    END IF;

    -- Si p_hasta es medianoche exacta (ej. seleccionado de calendario sin hora), cubrir todo el día
    IF date_trunc('day', p_hasta) = p_hasta THEN
      v_hasta := p_hasta + interval '1 day' - interval '1 microsecond';
    ELSE
      v_hasta := p_hasta;
    END IF;
    v_desde := p_desde;

  ELSIF p_periodo = '7d' THEN
    v_hasta := now();
    v_desde := date_trunc('day', now() - interval '6 days');

  ELSIF p_periodo = '30d' THEN
    v_hasta := now();
    v_desde := date_trunc('day', now() - interval '29 days');

  ELSIF p_periodo = '90d' THEN
    v_hasta := now();
    v_desde := date_trunc('day', now() - interval '89 days');

  ELSIF p_periodo = 'todo' THEN
    v_hasta := now();
    SELECT coalesce(min(fecha_creacion), date_trunc('day', now()))
      INTO v_desde
      FROM public.solicitudes_plan;
  END IF;

  -- Si el intervalo supera 90 días, agrupar evolución por mes para evitar sobrecarga
  IF v_hasta - v_desde > interval '90 days' THEN
    v_agrupacion := 'mes';
  ELSE
    v_agrupacion := 'dia';
  END IF;

  -- --------------------------------------------------------------------------
  -- C. Cálculo de KPIs escalares
  -- --------------------------------------------------------------------------
  -- 1. Solicitudes creadas en el período
  SELECT count(*)
    INTO v_solicitudes_total
    FROM public.solicitudes_plan
   WHERE fecha_creacion >= v_desde AND fecha_creacion <= v_hasta;

  -- 2. Expediciones registradas y estados en el período
  SELECT
    count(*),
    count(*) FILTER (WHERE estado_expedicion = 'COMPLETADA'),
    count(*) FILTER (WHERE estado_expedicion = 'PARCIAL'),
    count(*) FILTER (WHERE estado_expedicion = 'ABANDONADA'),
    coalesce(sum(coalesce(array_length(paradas_visitadas, 1), 0)), 0)
    INTO
      v_expediciones_total,
      v_expediciones_completadas,
      v_expediciones_parciales,
      v_expediciones_abandonadas,
      v_paradas_visitadas_total
    FROM public.expediciones_plan
   WHERE completado_en >= v_desde AND completado_en <= v_hasta;

  -- 3. Tasa de finalización (%) sobre expediciones con estado terminal en el período
  IF v_expediciones_total > 0 THEN
    v_tasa_finalizacion := round((v_expediciones_completadas::numeric / v_expediciones_total * 100), 2);
  ELSE
    v_tasa_finalizacion := 0;
  END IF;

  -- 4. Conversión de solicitudes de la cohorte del período con expedición asociada
  SELECT count(DISTINCT ep.solicitud_id)
    INTO v_solicitudes_con_expedicion
    FROM public.solicitudes_plan sp
    JOIN public.expediciones_plan ep ON ep.solicitud_id = sp.id
   WHERE sp.fecha_creacion >= v_desde AND sp.fecha_creacion <= v_hasta;

  IF v_solicitudes_total > 0 THEN
    v_tasa_conversion := round((v_solicitudes_con_expedicion::numeric / v_solicitudes_total * 100), 2);
  ELSE
    v_tasa_conversion := 0;
  END IF;

  -- --------------------------------------------------------------------------
  -- D. Ranking de categorías seleccionadas en solicitudes del período
  -- --------------------------------------------------------------------------
  SELECT coalesce(jsonb_agg(cat_row), '[]'::jsonb)
    INTO v_categorias_ranking
    FROM (
      SELECT
        c.id,
        c.nombre,
        count(spc.solicitud_id) AS total,
        round(
          CASE
            WHEN v_solicitudes_total > 0
            THEN (count(spc.solicitud_id)::numeric / v_solicitudes_total * 100)
            ELSE 0
          END, 2
        ) AS porcentaje
      FROM public.solicitudes_plan_categorias spc
      JOIN public.solicitudes_plan sp ON sp.id = spc.solicitud_id
      JOIN public.categorias c ON c.id = spc.categoria_id
      WHERE sp.fecha_creacion >= v_desde AND sp.fecha_creacion <= v_hasta
      GROUP BY c.id, c.nombre
      ORDER BY total DESC, c.nombre ASC
      LIMIT 10
    ) cat_row;

  -- --------------------------------------------------------------------------
  -- E. Ranking de destinos incluidos en expediciones registradas del período
  --    (cuenta expediciones distintas que contienen cada lugar en su snapshot)
  -- --------------------------------------------------------------------------
  SELECT coalesce(jsonb_agg(dest_row), '[]'::jsonb)
    INTO v_destinos_incluidos_ranking
    FROM (
      SELECT
        elem->'place'->>'id' AS id,
        coalesce(l.nombre, elem->'place'->>'nombre', 'Lugar sin nombre') AS nombre,
        count(DISTINCT ep.solicitud_id) AS total,
        round(
          CASE
            WHEN v_expediciones_total > 0
            THEN (count(DISTINCT ep.solicitud_id)::numeric / v_expediciones_total * 100)
            ELSE 0
          END, 2
        ) AS porcentaje
      FROM public.expediciones_plan ep,
      LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(ep.plan_snapshot) = 'object'
           AND jsonb_typeof(ep.plan_snapshot->'paradas') = 'array'
          THEN ep.plan_snapshot->'paradas'
          ELSE '[]'::jsonb
        END
      ) elem
      LEFT JOIN public.lugares l ON l.id::text = elem->'place'->>'id'
      WHERE ep.completado_en >= v_desde AND ep.completado_en <= v_hasta
        AND elem->'place'->>'id' IS NOT NULL
      GROUP BY elem->'place'->>'id', coalesce(l.nombre, elem->'place'->>'nombre', 'Lugar sin nombre')
      ORDER BY total DESC, nombre ASC
      LIMIT 10
    ) dest_row;

  -- --------------------------------------------------------------------------
  -- F. Ranking de destinos visitados efectivamente en el período
  --    (cuenta expediciones distintas que visitaron cada lugar)
  -- --------------------------------------------------------------------------
  SELECT coalesce(jsonb_agg(vis_row), '[]'::jsonb)
    INTO v_destinos_visitados_ranking
    FROM (
      SELECT
        v.lugar_id AS id,
        coalesce(l.nombre, 'Lugar ' || substring(v.lugar_id from 1 for 8)) AS nombre,
        count(DISTINCT ep.solicitud_id) AS total,
        round(
          CASE
            WHEN v_expediciones_total > 0
            THEN (count(DISTINCT ep.solicitud_id)::numeric / v_expediciones_total * 100)
            ELSE 0
          END, 2
        ) AS porcentaje
      FROM public.expediciones_plan ep,
      LATERAL unnest(ep.paradas_visitadas_ids) AS v(lugar_id)
      LEFT JOIN public.lugares l ON l.id::text = v.lugar_id
      WHERE ep.completado_en >= v_desde AND ep.completado_en <= v_hasta
        AND v.lugar_id IS NOT NULL AND v.lugar_id <> ''
      GROUP BY v.lugar_id, coalesce(l.nombre, 'Lugar ' || substring(v.lugar_id from 1 for 8))
      ORDER BY total DESC, nombre ASC
      LIMIT 10
    ) vis_row;

  -- --------------------------------------------------------------------------
  -- G. Evolución temporal agrupada (por día o mes sin producto cartesiano)
  -- --------------------------------------------------------------------------
  IF v_agrupacion = 'mes' THEN
    SELECT coalesce(jsonb_agg(evo_row), '[]'::jsonb)
      INTO v_evolucion
      FROM (
        WITH series AS (
          SELECT generate_series(
            date_trunc('month', v_desde),
            date_trunc('month', v_hasta),
            interval '1 month'
          ) AS punto
        ),
        sol_mensuales AS (
          SELECT
            date_trunc('month', fecha_creacion) AS punto,
            count(*) AS total
          FROM public.solicitudes_plan
          WHERE fecha_creacion >= v_desde AND fecha_creacion <= v_hasta
          GROUP BY 1
        ),
        exp_mensuales AS (
          SELECT
            date_trunc('month', completado_en) AS punto,
            count(*) AS total,
            count(*) FILTER (WHERE estado_expedicion = 'COMPLETADA') AS completadas,
            count(*) FILTER (WHERE estado_expedicion = 'PARCIAL') AS parciales,
            count(*) FILTER (WHERE estado_expedicion = 'ABANDONADA') AS abandonadas
          FROM public.expediciones_plan
          WHERE completado_en >= v_desde AND completado_en <= v_hasta
          GROUP BY 1
        )
        SELECT
          to_char(s.punto, 'YYYY-MM') AS fecha,
          coalesce(sm.total, 0) AS solicitudes,
          coalesce(em.total, 0) AS expediciones,
          coalesce(em.completadas, 0) AS completadas,
          coalesce(em.parciales, 0) AS parciales,
          coalesce(em.abandonadas, 0) AS abandonadas
        FROM series s
        LEFT JOIN sol_mensuales sm ON sm.punto = s.punto
        LEFT JOIN exp_mensuales em ON em.punto = s.punto
        ORDER BY s.punto ASC
      ) evo_row;
  ELSE
    SELECT coalesce(jsonb_agg(evo_row), '[]'::jsonb)
      INTO v_evolucion
      FROM (
        WITH series AS (
          SELECT generate_series(
            date_trunc('day', v_desde),
            date_trunc('day', v_hasta),
            interval '1 day'
          ) AS punto
        ),
        sol_diarias AS (
          SELECT
            date_trunc('day', fecha_creacion) AS punto,
            count(*) AS total
          FROM public.solicitudes_plan
          WHERE fecha_creacion >= v_desde AND fecha_creacion <= v_hasta
          GROUP BY 1
        ),
        exp_diarias AS (
          SELECT
            date_trunc('day', completado_en) AS punto,
            count(*) AS total,
            count(*) FILTER (WHERE estado_expedicion = 'COMPLETADA') AS completadas,
            count(*) FILTER (WHERE estado_expedicion = 'PARCIAL') AS parciales,
            count(*) FILTER (WHERE estado_expedicion = 'ABANDONADA') AS abandonadas
          FROM public.expediciones_plan
          WHERE completado_en >= v_desde AND completado_en <= v_hasta
          GROUP BY 1
        )
        SELECT
          to_char(s.punto, 'YYYY-MM-DD') AS fecha,
          coalesce(sd.total, 0) AS solicitudes,
          coalesce(ed.total, 0) AS expediciones,
          coalesce(ed.completadas, 0) AS completadas,
          coalesce(ed.parciales, 0) AS parciales,
          coalesce(ed.abandonadas, 0) AS abandonadas
        FROM series s
        LEFT JOIN sol_diarias sd ON sd.punto = s.punto
        LEFT JOIN exp_diarias ed ON ed.punto = s.punto
        ORDER BY s.punto ASC
      ) evo_row;
  END IF;

  -- --------------------------------------------------------------------------
  -- H. Construcción del resultado final
  -- --------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'rango', jsonb_build_object(
      'periodo', p_periodo,
      'desde', v_desde,
      'hasta', v_hasta,
      'agrupacion', v_agrupacion
    ),
    'kpis', jsonb_build_object(
      'solicitudes_total', v_solicitudes_total,
      'expediciones_total', v_expediciones_total,
      'expediciones_completadas', v_expediciones_completadas,
      'expediciones_parciales', v_expediciones_parciales,
      'expediciones_abandonadas', v_expediciones_abandonadas,
      'tasa_finalizacion', v_tasa_finalizacion,
      'tasa_conversion_solicitudes', v_tasa_conversion,
      'paradas_visitadas_total', v_paradas_visitadas_total
    ),
    'categorias_ranking', v_categorias_ranking,
    'destinos_incluidos_ranking', v_destinos_incluidos_ranking,
    'destinos_visitados_ranking', v_destinos_visitados_ranking,
    'evolucion', v_evolucion
  );
END;
$$;

COMMENT ON FUNCTION public.admin_get_reports IS
  'Calcula métricas agregadas de negocio y rankings para el panel de Reportes (RF20 / CU09). Requiere rol ADMIN.';

-- ----------------------------------------------------------------------------
-- 3. Permisos y seguridad de ejecución
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_get_reports(text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_reports(text, timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_reports(text, timestamptz, timestamptz) TO authenticated;
