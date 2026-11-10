-- ============================================================================
-- Fase 1.5 - Auditoria de acciones administrativas y metricas de negocio
-- ============================================================================
-- Que hace este archivo:
--   1. Crea la tabla public.admin_acciones donde queda registrado cada cambio
--      hecho por una persona con rol ADMIN.
--   2. Registra las acciones con disparadores (triggers) sobre las tablas
--      afectadas, no desde la aplicacion: si alguien toca los datos por otra
--      via, la fila igual queda auditada.
--   3. Expone dos funciones de lectura:
--        admin_get_acciones(p_limit, p_offset)  -> historial paginado
--        admin_get_business_metrics()           -> numeros para el tablero
--   4. Cierra la escritura directa: nadie puede insertar ni borrar auditoria
--      desde el cliente, solo los disparadores.
--
-- Es idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla de auditoria
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_acciones (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       uuid        NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  accion         text        NOT NULL,
  objetivo_tipo  text        NOT NULL,
  objetivo_id    uuid,
  detalle        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  creado_en      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_acciones_accion_check CHECK (
    accion IN (
      'EDITAR_USUARIO',
      'ANONIMIZAR_USUARIO',
      'SUSPENDER_USUARIO',
      'REACTIVAR_USUARIO',
      'ELIMINAR_SOLICITUD',
      'ELIMINAR_EXPEDICION'
    )
  ),
  CONSTRAINT admin_acciones_objetivo_check CHECK (
    objetivo_tipo IN ('USUARIO', 'SOLICITUD', 'EXPEDICION')
  )
);

COMMENT ON TABLE public.admin_acciones IS
  'Historial de cambios hechos por administradores. Se llena solo por disparadores.';

-- El historial siempre se consulta de lo mas nuevo a lo mas viejo.
CREATE INDEX IF NOT EXISTS admin_acciones_creado_en_idx
  ON public.admin_acciones (creado_en DESC);

CREATE INDEX IF NOT EXISTS admin_acciones_actor_idx
  ON public.admin_acciones (actor_id);

-- ----------------------------------------------------------------------------
-- 2. Seguridad: solo un administrador puede leer el historial
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_acciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_acciones_select_admin ON public.admin_acciones;

CREATE POLICY admin_acciones_select_admin
  ON public.admin_acciones
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Nadie escribe a mano: las filas las crean los disparadores.
REVOKE INSERT, UPDATE, DELETE ON public.admin_acciones FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.admin_acciones FROM anon;

-- ----------------------------------------------------------------------------
-- 3. Funcion de disparador: decide que accion fue y que guarda
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_accion_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor       uuid := auth.uid();
  v_accion      text;
  v_tipo        text;
  v_objetivo    uuid;
  v_detalle     jsonb := '{}'::jsonb;
BEGIN
  -- Si no hay sesion o quien escribe no es ADMIN, no se audita nada.
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN NULL;
  END IF;

  -- ---------------------------- Usuarios ------------------------------------
  IF TG_TABLE_NAME = 'usuarios' AND TG_OP = 'UPDATE' THEN
    v_tipo := 'USUARIO';
    v_objetivo := NEW.id;

    IF NEW.nombre IS DISTINCT FROM OLD.nombre AND NEW.estado = false AND OLD.estado = true THEN
      v_accion := 'ANONIMIZAR_USUARIO';
    ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
      IF NEW.estado THEN
        v_accion := 'REACTIVAR_USUARIO';
      ELSE
        v_accion := 'SUSPENDER_USUARIO';
      END IF;
    ELSE
      v_accion := 'EDITAR_USUARIO';
    END IF;

    v_detalle := jsonb_build_object(
      'antes', jsonb_build_object(
        'nombre', OLD.nombre,
        'rol', OLD.rol,
        'estado', OLD.estado
      ),
      'despues', jsonb_build_object(
        'nombre', NEW.nombre,
        'rol', NEW.rol,
        'estado', NEW.estado
      )
    );

  -- -------------------------- Solicitudes -----------------------------------
  ELSIF TG_TABLE_NAME = 'solicitudes_plan' AND TG_OP = 'DELETE' THEN
    v_tipo := 'SOLICITUD';
    v_accion := 'ELIMINAR_SOLICITUD';
    v_objetivo := OLD.id;

    v_detalle := jsonb_build_object(
      'usuario_id', OLD.usuario_id,
      'movilidad', OLD.movilidad,
      'fecha_hora_inicio', OLD.fecha_hora_inicio,
      'fecha_hora_fin', OLD.fecha_hora_fin,
      'gasto_max', OLD.gasto_max
    );

  -- -------------------------- Expediciones ----------------------------------
  ELSIF TG_TABLE_NAME = 'expediciones_plan' AND TG_OP = 'DELETE' THEN
    v_tipo := 'EXPEDICION';
    v_accion := 'ELIMINAR_EXPEDICION';
    v_objetivo := OLD.solicitud_id;

    v_detalle := jsonb_build_object(
      'usuario_id', OLD.usuario_id,
      'estado_expedicion', OLD.estado_expedicion,
      'completado_en', OLD.completado_en,
      'paradas_visitadas', coalesce(array_length(OLD.paradas_visitadas, 1), 0)
    );

  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO public.admin_acciones (actor_id, accion, objetivo_tipo, objetivo_id, detalle)
  VALUES (v_actor, v_accion, v_tipo, v_objetivo, v_detalle);

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.registrar_accion_admin() IS
  'Anota en admin_acciones los cambios hechos por un ADMIN. Se invoca por disparador.';

-- ----------------------------------------------------------------------------
-- 4. Disparadores sobre las tablas que importa vigilar
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_auditar_usuarios ON public.usuarios;
CREATE TRIGGER trg_auditar_usuarios
  AFTER UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_accion_admin();

DROP TRIGGER IF EXISTS trg_auditar_solicitudes ON public.solicitudes_plan;
CREATE TRIGGER trg_auditar_solicitudes
  AFTER DELETE ON public.solicitudes_plan
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_accion_admin();

DROP TRIGGER IF EXISTS trg_auditar_expediciones ON public.expediciones_plan;
CREATE TRIGGER trg_auditar_expediciones
  AFTER DELETE ON public.expediciones_plan
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_accion_admin();

-- ----------------------------------------------------------------------------
-- 5. Lectura del historial paginado
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_acciones(
  p_limit  int DEFAULT 30,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id            uuid,
  accion        text,
  objetivo_tipo text,
  objetivo_id   uuid,
  detalle       jsonb,
  creado_en     timestamptz,
  actor_nombre  text,
  actor_email   text,
  total_count   bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_limit  int;
  v_offset int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  v_limit  := greatest(1, least(coalesce(p_limit, 30), 100));
  v_offset := greatest(0, coalesce(p_offset, 0));

  RETURN QUERY
  SELECT
    a.id,
    a.accion::text,
    a.objetivo_tipo::text,
    a.objetivo_id,
    a.detalle,
    a.creado_en,
    u.nombre::text,
    au.email::text,
    count(*) OVER() AS total_count
  FROM public.admin_acciones a
  JOIN public.usuarios u  ON u.id = a.actor_id
  LEFT JOIN auth.users au ON au.id = a.actor_id
  ORDER BY a.creado_en DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.admin_get_acciones IS
  'Devuelve el historial de acciones administrativas, paginado y de lo mas reciente a lo mas antiguo.';

-- ----------------------------------------------------------------------------
-- 6. Metricas de negocio para el tablero
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_business_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'usuarios_total', (
      SELECT count(*) FROM public.usuarios
    ),
    'usuarios_activos', (
      SELECT count(*) FROM public.usuarios WHERE estado = true
    ),
    'admins_total', (
      SELECT count(*) FROM public.usuarios WHERE rol = 'ADMIN' AND estado = true
    ),
    'solicitudes_total', (
      SELECT count(*) FROM public.solicitudes_plan
    ),
    'solicitudes_ultimos_7_dias', (
      SELECT count(*) FROM public.solicitudes_plan
      WHERE fecha_creacion >= now() - interval '7 days'
    ),
    'expediciones_total', (
      SELECT count(*) FROM public.expediciones_plan
    ),
    'expediciones_completadas', (
      SELECT count(*) FROM public.expediciones_plan WHERE estado_expedicion = 'COMPLETADA'
    ),
    'paradas_visitadas_total', (
      SELECT coalesce(sum(coalesce(array_length(paradas_visitadas, 1), 0)), 0)
      FROM public.expediciones_plan
    ),
    'lugares_activos', (
      SELECT count(*) FROM public.lugares WHERE estado = true
    ),
    'lugares_con_portada', (
      SELECT count(DISTINCT lugar_id) FROM public.lugares_imagenes WHERE es_portada = true
    ),
    'imagenes_total', (
      SELECT count(*) FROM public.lugares_imagenes
    ),
    'gasto_promedio_plan', (
      SELECT coalesce(round(avg(gasto_max), 2), 0) FROM public.solicitudes_plan
    ),
    'acciones_admin_total', (
      SELECT count(*) FROM public.admin_acciones
    )
  );
END;
$$;

COMMENT ON FUNCTION public.admin_get_business_metrics IS
  'Resume en un solo JSON el estado de uso de la aplicacion. Solo para administradores.';

-- ----------------------------------------------------------------------------
-- 7. Permisos de ejecucion
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_get_acciones(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_business_metrics() TO authenticated;
