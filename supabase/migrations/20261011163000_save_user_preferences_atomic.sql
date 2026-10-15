-- ============================================================================
-- MIGRACIÓN CHASKI: Persistencia Atómica de Preferencias de Usuario (Serie AX)
-- Archivo: supabase/migrations/20261011163000_save_user_preferences_atomic.sql
--
-- Objetivos:
-- 1. Eliminar el guardado no transaccional (upsert + delete + insert por separado).
-- 2. Garantizar atomicidad completa bajo SECURITY INVOKER.
-- 3. Proteger la identidad mediante auth.uid() (sin permitir suplantación de usuario).
-- 4. Serializar peticiones concurrentes del mismo usuario con pg_advisory_xact_lock.
-- 5. Preservar movilidad_preferida si no se solicita actualizarla explícitamente.
-- 6. Validar categorías existentes y activas, evitando estados huérfanos.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_user_preferences_atomic(
  p_category_ids uuid[],
  p_gasto_min numeric DEFAULT NULL,
  p_gasto_max numeric DEFAULT NULL,
  p_movilidad_preferida varchar DEFAULT NULL,
  p_actualizar_movilidad boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_unique_category_ids uuid[];
  v_active_categories_count integer;
  v_now timestamptz := now();
  v_cat_id uuid;
BEGIN
  -- 1. Autenticación: Identificar al usuario desde la sesión JWT activa
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Sesión no válida o no autenticada'
      USING ERRCODE = '28000';
  END IF;

  -- 2. Concurrencia: Bloqueo consultivo transaccional por usuario
  -- Serializa solicitudes concurrentes del mismo usuario tanto en creación inicial como actualización
  PERFORM pg_advisory_xact_lock(hashtext('pref_' || v_user_id::text));

  -- 3. Validación de Presupuesto no negativo y rangos coherentes
  IF p_gasto_min IS NOT NULL AND p_gasto_min < 0 THEN
    RAISE EXCEPTION 'INVALID_BUDGET_MIN: El gasto mínimo no puede ser negativo'
      USING ERRCODE = '22003';
  END IF;

  IF p_gasto_max IS NOT NULL AND p_gasto_max < 0 THEN
    RAISE EXCEPTION 'INVALID_BUDGET_MAX: El gasto máximo no puede ser negativo'
      USING ERRCODE = '22003';
  END IF;

  IF p_gasto_min IS NOT NULL AND p_gasto_max IS NOT NULL AND p_gasto_min > p_gasto_max THEN
    RAISE EXCEPTION 'INVALID_BUDGET_RANGE: El gasto mínimo no puede superar el gasto máximo'
      USING ERRCODE = '22023';
  END IF;

  -- 4. Normalización: Desduplicar y limpiar array de categorías
  SELECT coalesce(array_agg(DISTINCT cid), '{}'::uuid[])
  INTO v_unique_category_ids
  FROM unnest(p_category_ids) AS cid
  WHERE cid IS NOT NULL;

  -- 5. Exigir al menos una categoría seleccionada
  IF cardinality(v_unique_category_ids) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CATEGORIES: Debe seleccionar al menos una categoría de interés'
      USING ERRCODE = '22023';
  END IF;

  -- 6. Validar que todas las categorías seleccionadas existan y estén activas
  SELECT count(*)
  INTO v_active_categories_count
  FROM public.categorias
  WHERE id = ANY(v_unique_category_ids)
    AND estado = true;

  IF v_active_categories_count <> cardinality(v_unique_category_ids) THEN
    RAISE EXCEPTION 'INVALID_CATEGORIES: Una o más categorías seleccionadas son inválidas o están inactivas'
      USING ERRCODE = '23503';
  END IF;

  -- 7. Upsert en preferencias_usuario preservando movilidad_preferida si no se solicita actualizarla
  INSERT INTO public.preferencias_usuario (
    usuario_id,
    movilidad_preferida,
    gasto_min,
    gasto_max,
    updated_at
  )
  VALUES (
    v_user_id,
    p_movilidad_preferida,
    p_gasto_min,
    p_gasto_max,
    v_now
  )
  ON CONFLICT (usuario_id) DO UPDATE SET
    movilidad_preferida = CASE
      WHEN p_actualizar_movilidad THEN EXCLUDED.movilidad_preferida
      ELSE preferencias_usuario.movilidad_preferida
    END,
    gasto_min = EXCLUDED.gasto_min,
    gasto_max = EXCLUDED.gasto_max,
    updated_at = EXCLUDED.updated_at;

  -- 8. Reemplazo atómico de categorías del usuario
  DELETE FROM public.preferencias_usuario_categorias
  WHERE usuario_id = v_user_id;

  FOREACH v_cat_id IN ARRAY v_unique_category_ids LOOP
    INSERT INTO public.preferencias_usuario_categorias (
      usuario_id,
      categoria_id
    )
    VALUES (
      v_user_id,
      v_cat_id
    );
  END LOOP;

  -- 9. Retorno informativo
  RETURN jsonb_build_object(
    'success', true,
    'usuario_id', v_user_id,
    'categories_saved', cardinality(v_unique_category_ids),
    'updated_at', v_now
  );
END;
$$;

-- 10. Privilegios de ejecución mínimos
REVOKE EXECUTE ON FUNCTION public.save_user_preferences_atomic(uuid[], numeric, numeric, varchar, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_user_preferences_atomic(uuid[], numeric, numeric, varchar, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_user_preferences_atomic(uuid[], numeric, numeric, varchar, boolean) TO authenticated;

COMMENT ON FUNCTION public.save_user_preferences_atomic IS
  'Guarda atómicamente preferencias y categorías activas para el usuario en sesión mediante SECURITY INVOKER.';
