-- ============================================================================
-- CHASKI . CRUD administrativo (Fase 1 / APF3)
-- ============================================================================
-- Que agrega esta migracion:
--   1. admin_update_user ........ editar nombre, rol y estado de un usuario
--   2. admin_anonymize_user ..... baja definitiva (anonimiza), NO borra fisico
--   3. admin_get_solicitudes .... listar TODAS las solicitudes de plan
--   4. admin_delete_solicitud ... eliminar una solicitud de plan
--   5. admin_get_expediciones ... listar expediciones registradas
--   6. admin_delete_expedicion .. eliminar el registro de una expedicion
--
-- Decisiones de diseno:
--   * Ninguna funcion permite DELETE fisico de public.usuarios: la migracion
--     20261014100000_admin_roles_and_management.sql revoca ese privilegio por
--     requisito del MVP. La "eliminacion" de un usuario se resuelve con
--     anonimizacion + estado = false (baja definitiva, auditable).
--   * Crear usuarios (la C del CRUD) no es posible desde la app: requiere la
--     Admin API de Supabase con service_role. Se hace desde el panel o con una
--     Edge Function; nunca con la clave publicable.
--   * Todas las funciones son SECURITY DEFINER, validan is_admin() y usan
--     advisory lock para serializar cambios sobre el padron.
--   * Mensajes y comentarios en ASCII puro para poder pegarlos en el SQL Editor
--     sin riesgo de corromper acentos.
-- ============================================================================

-- -- 1. Editar usuario (nombre, rol, estado) ---------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_target_user_id uuid,
  p_nombre text,
  p_rol text,
  p_estado boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid;
  v_target record;
  v_nombre text;
  v_rol text;
  v_admins_activos bigint;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Sesion no valida o no autenticada'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('admin_user_status_lock'));

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_TARGET: El usuario objetivo es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  SELECT id, nombre, rol, estado
  INTO v_target
  FROM public.usuarios
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: El usuario especificado no existe'
      USING ERRCODE = 'P0002';
  END IF;

  -- Validacion de entradas
  v_nombre := btrim(coalesce(p_nombre, ''));
  v_rol := upper(btrim(coalesce(p_rol, '')));

  IF char_length(v_nombre) < 2 OR char_length(v_nombre) > 60 THEN
    RAISE EXCEPTION 'INVALID_NAME: El nombre debe tener entre 2 y 60 caracteres'
      USING ERRCODE = '22023';
  END IF;

  IF v_rol NOT IN ('USUARIO', 'ADMIN') THEN
    RAISE EXCEPTION 'INVALID_ROLE: El rol debe ser USUARIO o ADMIN'
      USING ERRCODE = '22023';
  END IF;

  IF p_estado IS NULL THEN
    RAISE EXCEPTION 'INVALID_STATUS: El estado no puede ser nulo'
      USING ERRCODE = '22023';
  END IF;

  -- Salvaguarda 1: nadie se quita a si mismo el rol ADMIN
  IF p_target_user_id = v_admin_id AND v_rol <> 'ADMIN' THEN
    RAISE EXCEPTION 'CANNOT_DEMOTE_SELF: No puedes quitarte tu propio rol de administrador'
      USING ERRCODE = '22023';
  END IF;

  -- Salvaguarda 2: nadie se autodesactiva
  IF p_target_user_id = v_admin_id AND p_estado = false THEN
    RAISE EXCEPTION 'CANNOT_DEACTIVATE_SELF: No puedes desactivar tu propia cuenta de administrador'
      USING ERRCODE = '22023';
  END IF;

  -- Salvaguarda 3: el ultimo ADMIN activo no puede degradarse ni desactivarse
  IF v_target.rol = 'ADMIN' AND (v_rol <> 'ADMIN' OR p_estado = false) THEN
    SELECT count(*)
    INTO v_admins_activos
    FROM public.usuarios
    WHERE rol = 'ADMIN' AND estado = true;

    IF v_admins_activos <= 1 THEN
      RAISE EXCEPTION 'LAST_ADMIN_PROTECTION: No se puede degradar ni desactivar al unico administrador activo'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.usuarios
  SET nombre = v_nombre,
      rol = v_rol,
      estado = p_estado
  WHERE id = p_target_user_id;

  RETURN jsonb_build_object(
    'usuario_id', p_target_user_id,
    'nombre_anterior', v_target.nombre,
    'nombre_nuevo', v_nombre,
    'rol_anterior', v_target.rol,
    'rol_nuevo', v_rol,
    'estado_anterior', v_target.estado,
    'estado_nuevo', p_estado,
    'modificado_por', v_admin_id,
    'timestamp', now()
  );
END;
$$;

COMMENT ON FUNCTION public.admin_update_user(uuid, text, text, boolean) IS
  'Edita nombre, rol y estado de un usuario con salvaguardas de auto-degradacion y ultimo admin. Solo ADMIN.';

-- -- 2. Baja definitiva de usuario (anonimizar, sin DELETE fisico) -----------
CREATE OR REPLACE FUNCTION public.admin_anonymize_user(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid;
  v_target record;
  v_admins_activos bigint;
  v_nombre_baja text;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Sesion no valida o no autenticada'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('admin_user_status_lock'));

  SELECT id, nombre, rol, estado
  INTO v_target
  FROM public.usuarios
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: El usuario especificado no existe'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_target_user_id = v_admin_id THEN
    RAISE EXCEPTION 'CANNOT_DELETE_SELF: No puedes dar de baja tu propia cuenta'
      USING ERRCODE = '22023';
  END IF;

  IF v_target.rol = 'ADMIN' AND v_target.estado = true THEN
    SELECT count(*)
    INTO v_admins_activos
    FROM public.usuarios
    WHERE rol = 'ADMIN' AND estado = true;

    IF v_admins_activos <= 1 THEN
      RAISE EXCEPTION 'LAST_ADMIN_PROTECTION: No se puede dar de baja al unico administrador activo'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Se preserva la fila (integridad historica) pero se anulan los datos
  -- personales y se desactiva el acceso.
  v_nombre_baja := 'Usuario dado de baja';

  UPDATE public.usuarios
  SET nombre = v_nombre_baja,
      estado = false
  WHERE id = p_target_user_id;

  RETURN jsonb_build_object(
    'usuario_id', p_target_user_id,
    'nombre_anterior', v_target.nombre,
    'nombre_nuevo', v_nombre_baja,
    'estado_nuevo', false,
    'modo', 'ANONIMIZADO',
    'eliminado_por', v_admin_id,
    'timestamp', now()
  );
END;
$$;

COMMENT ON FUNCTION public.admin_anonymize_user(uuid) IS
  'Baja definitiva sin DELETE fisico: anonimiza el nombre y desactiva el acceso. Solo ADMIN.';

-- -- 3. Listar solicitudes de plan de todos los usuarios ---------------------
CREATE OR REPLACE FUNCTION public.admin_get_solicitudes(
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  usuario_id uuid,
  usuario_nombre text,
  usuario_email text,
  fecha_hora_inicio timestamptz,
  fecha_hora_fin timestamptz,
  inicio_descripcion text,
  tipo_punto_final text,
  movilidad text,
  gasto_max numeric,
  fecha_creacion timestamptz,
  categorias text,
  estado_expedicion text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_search_pattern text := NULL;
  v_limit int;
  v_offset int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset := greatest(0, coalesce(p_offset, 0));

  IF p_search IS NOT NULL AND trim(p_search) <> '' THEN
    v_search_pattern := '%' || trim(p_search) || '%';
  END IF;

  RETURN QUERY
  SELECT
    sp.id,
    sp.usuario_id,
    u.nombre::text,
    au.email::text,
    sp.fecha_hora_inicio,
    sp.fecha_hora_fin,
    sp.inicio_descripcion,
    sp.tipo_punto_final,
    sp.movilidad,
    sp.gasto_max,
    sp.fecha_creacion,
    coalesce(cat.nombres, 'Sin intereses')::text AS categorias,
    e.estado_expedicion,
    count(*) OVER() AS total_count
  FROM public.solicitudes_plan sp
  JOIN public.usuarios u ON u.id = sp.usuario_id
  LEFT JOIN auth.users au ON au.id = sp.usuario_id
  LEFT JOIN LATERAL (
    SELECT string_agg(c.nombre, ', ' ORDER BY c.nombre) AS nombres
    FROM public.solicitudes_plan_categorias spc
    JOIN public.categorias c ON c.id = spc.categoria_id
    WHERE spc.solicitud_id = sp.id
  ) cat ON true
  LEFT JOIN public.expediciones_plan e ON e.solicitud_id = sp.id
  WHERE
    v_search_pattern IS NULL
    OR u.nombre ILIKE v_search_pattern
    OR au.email ILIKE v_search_pattern
    OR sp.inicio_descripcion ILIKE v_search_pattern
  ORDER BY sp.fecha_creacion DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.admin_get_solicitudes(text, int, int) IS
  'Lista paginada de todas las solicitudes de plan con usuario, intereses y estado de expedicion. Solo ADMIN.';

-- -- 4. Eliminar una solicitud de plan --------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_solicitud(p_solicitud_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid;
  v_target record;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Sesion no valida o no autenticada'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, usuario_id, fecha_creacion
  INTO v_target
  FROM public.solicitudes_plan
  WHERE id = p_solicitud_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOLICITUD_NOT_FOUND: La solicitud especificada no existe'
      USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.solicitudes_plan WHERE id = p_solicitud_id;

  RETURN jsonb_build_object(
    'solicitud_id', p_solicitud_id,
    'usuario_id', v_target.usuario_id,
    'eliminado_por', v_admin_id,
    'timestamp', now()
  );
END;
$$;

COMMENT ON FUNCTION public.admin_delete_solicitud(uuid) IS
  'Elimina una solicitud de plan (cascada a categorias y expedicion asociada). Solo ADMIN.';

-- -- 5. Listar expediciones registradas -------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_expediciones(
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  solicitud_id uuid,
  usuario_id uuid,
  usuario_nombre text,
  usuario_email text,
  estado_expedicion text,
  completado_en timestamptz,
  total_paradas int,
  visitadas int,
  titulo_plan text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_search_pattern text := NULL;
  v_limit int;
  v_offset int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset := greatest(0, coalesce(p_offset, 0));

  IF p_search IS NOT NULL AND trim(p_search) <> '' THEN
    v_search_pattern := '%' || trim(p_search) || '%';
  END IF;

  RETURN QUERY
  SELECT
    e.solicitud_id,
    e.usuario_id,
    u.nombre::text,
    au.email::text,
    e.estado_expedicion::text,
    e.completado_en,
    coalesce(jsonb_array_length(e.plan_snapshot -> 'paradas'), 0)::int AS total_paradas,
    coalesce(array_length(e.paradas_visitadas, 1), 0)::int AS visitadas,
    coalesce(e.plan_snapshot ->> 'titulo', 'Sin titulo')::text AS titulo_plan,
    count(*) OVER() AS total_count
  FROM public.expediciones_plan e
  JOIN public.usuarios u ON u.id = e.usuario_id
  LEFT JOIN auth.users au ON au.id = e.usuario_id
  WHERE
    v_search_pattern IS NULL
    OR u.nombre ILIKE v_search_pattern
    OR au.email ILIKE v_search_pattern
    OR (e.plan_snapshot ->> 'titulo') ILIKE v_search_pattern
  ORDER BY e.completado_en DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.admin_get_expediciones(text, int, int) IS
  'Lista paginada de expediciones completadas con avance de paradas. Solo ADMIN.';

-- -- 6. Eliminar una expedicion ---------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_expedicion(p_solicitud_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid;
  v_target record;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Sesion no valida o no autenticada'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  SELECT solicitud_id, usuario_id, estado_expedicion
  INTO v_target
  FROM public.expediciones_plan
  WHERE solicitud_id = p_solicitud_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXPEDICION_NOT_FOUND: La expedicion especificada no existe'
      USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.expediciones_plan WHERE solicitud_id = p_solicitud_id;

  RETURN jsonb_build_object(
    'solicitud_id', p_solicitud_id,
    'usuario_id', v_target.usuario_id,
    'estado_anterior', v_target.estado_expedicion,
    'eliminado_por', v_admin_id,
    'timestamp', now()
  );
END;
$$;

COMMENT ON FUNCTION public.admin_delete_expedicion(uuid) IS
  'Elimina el registro de expedicion de una solicitud. Solo ADMIN.';

-- -- 7. Permisos (mismo criterio que el resto de RPCs admin) ---------------
REVOKE ALL ON FUNCTION public.admin_update_user(uuid, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_anonymize_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_solicitudes(text, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_solicitud(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_expediciones(text, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_expedicion(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_anonymize_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_solicitudes(text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_solicitud(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_expediciones(text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_expedicion(uuid) TO authenticated;

-- -- 8. Verificacion --------------------------------------------------------
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'admin_update_user',
      'admin_anonymize_user',
      'admin_get_solicitudes',
      'admin_delete_solicitud',
      'admin_get_expediciones',
      'admin_delete_expedicion'
    );

  IF v_count < 6 THEN
    RAISE EXCEPTION 'VERIFICACION_FALLIDA: se esperaban 6 funciones admin y hay %', v_count;
  END IF;

  RAISE NOTICE 'OK: % funciones de CRUD administrativo desplegadas', v_count;
END;
$$;
