-- ============================================================================
-- MIGRACIÓN CHASKI: Módulo de Roles y Administración (Serie AX)
-- Archivo: supabase/migrations/20261014100000_admin_roles_and_management.sql
--
-- Objetivos y Alcance:
-- 1. Sincronización automática de auth.users hacia public.usuarios (Trigger on_auth_user_created).
-- 2. Sincronización idempotente de usuarios históricos con valores por defecto (rol: USUARIO, estado: true).
-- 3. Restricciones de integridad (CHECK rol IN ('USUARIO', 'ADMIN')) e índices de rendimiento.
-- 4. Políticas RLS estrictas en public.usuarios (auto-lectura de perfil, edición restringida).
-- 5. Función de autorización de alta velocidad is_admin() con cacheo y search_path seguro.
-- 6. Función de verificación de estado activo is_active_user().
-- 7. RPC admin_get_users: Listado paginado con búsqueda por nombre o correo (JOIN con auth.users).
-- 8. RPC admin_get_metrics: Indicadores agregados de intendencia (total, activos, inactivos, admins).
-- 9. RPC admin_set_user_status: Activación / desactivación con protección contra:
--    - Auto-desactivación del propio administrador en sesión.
--    - Desactivación del último administrador activo del sistema.
--    - Concurrencia mediante bloqueo consultivo transaccional pg_advisory_xact_lock.
-- 10. Actualización de save_user_preferences_atomic para impedir operaciones a usuarios desactivados.
-- 11. Actualización de políticas de Storage (avatars) para exigir cuenta activa.
-- 12. Procedimiento documentado para designación controlada del primer ADMIN.
-- ============================================================================

-- ============================================================================
-- SECCIÓN 1: ESTRUCTURA, RESTRICCIONES E ÍNDICES EN public.usuarios
-- ============================================================================

-- 1.1 Asegurar que existan las columnas requeridas si no estuvieran presentes
DO $$
BEGIN
  -- Verificar tipo de columna rol y agregar restricción CHECK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_rol_check'
  ) THEN
    ALTER TABLE public.usuarios 
      ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('USUARIO', 'ADMIN'));
  END IF;

  -- Asegurar valor por defecto para estado y fecha_registro
  ALTER TABLE public.usuarios ALTER COLUMN estado SET DEFAULT true;
  ALTER TABLE public.usuarios ALTER COLUMN rol SET DEFAULT 'USUARIO';
  ALTER TABLE public.usuarios ALTER COLUMN fecha_registro SET DEFAULT now();
EXCEPTION
  WHEN OTHERS THEN
    -- Manejo defensivo en caso de que las columnas ya posean restricciones similares
    NULL;
END $$;

-- 1.2 Índices para búsquedas, filtros y joins de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_usuarios_rol_estado ON public.usuarios (rol, estado);
CREATE INDEX IF NOT EXISTS idx_usuarios_fecha_registro ON public.usuarios (fecha_registro DESC);
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre_trgm ON public.usuarios USING btree (nombre);

-- ============================================================================
-- SECCIÓN 2: TRIGGER DE SINCRONIZACIÓN AUTOMÁTICA (auth.users -> public.usuarios)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nombre text;
BEGIN
  -- Extraer el nombre de raw_user_meta_data si fue proporcionado durante signUp
  v_nombre := trim(coalesce(NEW.raw_user_meta_data->>'nombre', ''));
  IF v_nombre = '' THEN
    v_nombre := split_part(coalesce(NEW.email, 'Explorador'), '@', 1);
  END IF;

  INSERT INTO public.usuarios (
    id,
    nombre,
    rol,
    estado,
    fecha_registro
  )
  VALUES (
    NEW.id,
    v_nombre,
    'USUARIO',
    true,
    coalesce(NEW.created_at, now())
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS 
  'Sincroniza automáticamente la creación de una cuenta en auth.users hacia public.usuarios con rol USUARIO y estado activo.';

-- Recreación idempotente del trigger sobre auth.users al registrarse
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2.2 Sincronización automática de actualización de nombre (auth.users -> public.usuarios)
-- Garantiza que Auth metadata sea la fuente única de verdad para el nombre del explorador
CREATE OR REPLACE FUNCTION public.handle_user_metadata_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nuevo_nombre text;
BEGIN
  -- Si el nombre en los metadatos cambió, actualizar public.usuarios
  IF NEW.raw_user_meta_data IS DISTINCT FROM OLD.raw_user_meta_data THEN
    v_nuevo_nombre := trim(coalesce(NEW.raw_user_meta_data->>'nombre', ''));
    IF v_nuevo_nombre <> '' THEN
      UPDATE public.usuarios
      SET nombre = v_nuevo_nombre
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_user_metadata_updated IS
  'Sincroniza cambios de nombre desde auth.users.raw_user_meta_data hacia public.usuarios, manteniendo Auth metadata como fuente única de verdad.';

DROP TRIGGER IF EXISTS on_auth_user_metadata_updated ON auth.users;
CREATE TRIGGER on_auth_user_metadata_updated
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_metadata_updated();

-- ============================================================================
-- SECCIÓN 3: SINCRONIZACIÓN IDEMPOTENTE DE USUARIOS HISTÓRICOS
-- ============================================================================

-- Inserta cualquier usuario que ya exista en auth.users pero falte en public.usuarios,
-- respetando rigurosamente los roles y estados ya existentes (DO NOTHING).
INSERT INTO public.usuarios (
  id,
  nombre,
  rol,
  estado,
  fecha_registro
)
SELECT
  au.id,
  coalesce(nullif(trim(au.raw_user_meta_data->>'nombre'), ''), split_part(coalesce(au.email, 'Explorador'), '@', 1)),
  'USUARIO',
  true,
  coalesce(au.created_at, now())
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.usuarios u WHERE u.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SECCIÓN 4: FUNCIONES DE AUTORIZACIÓN (SECURITY DEFINER CON SEARCH_PATH)
-- ============================================================================

-- 4.1 Función de verificación de Administrador (optimizada para RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = (SELECT auth.uid())
      AND rol = 'ADMIN'
      AND estado = true
  );
$$;

COMMENT ON FUNCTION public.is_admin IS 
  'Retorna true si el usuario de la sesión actual es un ADMIN activo. Uso en RLS y RPCs.';

-- 4.2 Función de verificación de Usuario Activo
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = (SELECT auth.uid())
      AND estado = true
  );
$$;

COMMENT ON FUNCTION public.is_active_user IS 
  'Retorna true si el usuario de la sesión actual existe y tiene estado activo (true).';

-- ============================================================================
-- SECCIÓN 5: SEGURIDAD, INMUTABILIDAD Y POLÍTICAS RLS EN public.usuarios
-- ============================================================================

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 5.1 Lectura: Un usuario puede leer su propio perfil, O un ADMIN puede leer todos los perfiles
DROP POLICY IF EXISTS "Lectura de perfil propio o por administrador" ON public.usuarios;
CREATE POLICY "Lectura de perfil propio o por administrador"
ON public.usuarios FOR SELECT
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT public.is_admin())
);

-- 5.2 Control estricto de privilegios SQL:
-- La fuente de verdad del nombre es auth.users.raw_user_meta_data. Los cambios legítimos
-- se realizan vía supabase.auth.updateUser({ data: { nombre } }) y el trigger sincroniza public.usuarios.
-- Por seguridad y coherencia estricta, los clientes autenticados NO pueden ejecutar sentencias
-- UPDATE ni DELETE directas sobre public.usuarios.
-- Solo pueden realizar SELECT (restringido por RLS).
-- La modificación de estado y rol solo ocurre internamente vía RPC admin_set_user_status (SECURITY DEFINER).
REVOKE ALL ON public.usuarios FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.usuarios TO authenticated;

-- Eliminar cualquier política de UPDATE directo para authenticated
DROP POLICY IF EXISTS "Actualizacion de nombre propio" ON public.usuarios;

-- 5.3 Trigger de inmutabilidad estricta: Impide cualquier alteración no autorizada
-- de 'rol', 'estado', 'id' o 'fecha_registro' a nivel de base de datos.
CREATE OR REPLACE FUNCTION public.check_user_update_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Protección contra mutación de ID y fecha de registro
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'CANNOT_MODIFY_ID: El identificador de usuario es inmutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.fecha_registro IS DISTINCT FROM OLD.fecha_registro THEN
    RAISE EXCEPTION 'CANNOT_MODIFY_REGISTRATION_DATE: La fecha de registro es inmutable'
      USING ERRCODE = '42501';
  END IF;

  -- Permitir operaciones directas de mantenimiento / seeding del DBA fuera del contexto de API de usuario
  IF session_user IN ('postgres', 'supabase_admin') AND (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Si el usuario en sesión no es un ADMIN activo verificado por is_admin(),
  -- se prohíbe terminantemente alterar el rol o el estado.
  IF NOT public.is_admin() THEN
    IF NEW.rol IS DISTINCT FROM OLD.rol THEN
      RAISE EXCEPTION 'CANNOT_MODIFY_ROLE: No tienes autorización para alterar el rol'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
      RAISE EXCEPTION 'CANNOT_MODIFY_STATUS: No tienes autorización para alterar el estado de la cuenta'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_fields ON public.usuarios;
CREATE TRIGGER trg_protect_user_fields
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.check_user_update_privileges();

-- 5.4 REQUISITO MVP: No permitir eliminación física de usuarios (DELETE).
-- Se eliminan formalmente las políticas de DELETE y se revocan los privilegios DELETE.
DROP POLICY IF EXISTS "Eliminacion de usuarios restringida a administradores" ON public.usuarios;
REVOKE DELETE ON public.usuarios FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- SECCIÓN 6: PROCEDIMIENTOS ALMACENADOS (RPC) DEL MÓDULO ADMINISTRATIVO
-- ============================================================================

-- 6.1 RPC: admin_get_metrics
-- Retorna indicadores de usuarios para el tablero de intendencia Serie AX
CREATE OR REPLACE FUNCTION public.admin_get_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_usuarios bigint;
  v_usuarios_activos bigint;
  v_usuarios_inactivos bigint;
  v_total_admins bigint;
BEGIN
  -- Autorización estricta
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE estado = true),
    count(*) FILTER (WHERE estado = false),
    count(*) FILTER (WHERE rol = 'ADMIN')
  INTO
    v_total_usuarios,
    v_usuarios_activos,
    v_usuarios_inactivos,
    v_total_admins
  FROM public.usuarios;

  RETURN jsonb_build_object(
    'total_usuarios', v_total_usuarios,
    'usuarios_activos', v_usuarios_activos,
    'usuarios_inactivos', v_usuarios_inactivos,
    'total_administradores', v_total_admins,
    'timestamp', now()
  );
END;
$$;

COMMENT ON FUNCTION public.admin_get_metrics IS 
  'Retorna métricas agregadas del padrón de exploradores. Exclusivo para administradores.';

-- 6.2 RPC: admin_get_users
-- Listado paginado con búsqueda de usuarios cruzando con auth.users para obtener el correo
CREATE OR REPLACE FUNCTION public.admin_get_users(
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_filtro_rol text DEFAULT NULL,
  p_filtro_estado boolean DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  nombre text,
  email text,
  rol text,
  estado boolean,
  fecha_registro timestamptz,
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
  -- 1. Autorización estricta
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Sanitizar paginación
  v_limit := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset := greatest(0, coalesce(p_offset, 0));

  IF p_search IS NOT NULL AND trim(p_search) <> '' THEN
    v_search_pattern := '%' || trim(p_search) || '%';
  END IF;

  -- 3. Consulta de usuarios con total_count en ventana analítica
  RETURN QUERY
  SELECT
    u.id,
    u.nombre::text,
    au.email::text,
    u.rol::text,
    u.estado,
    u.fecha_registro,
    count(*) OVER() AS total_count
  FROM public.usuarios u
  JOIN auth.users au ON u.id = au.id
  WHERE
    (v_search_pattern IS NULL OR (u.nombre ILIKE v_search_pattern OR au.email ILIKE v_search_pattern))
    AND (p_filtro_rol IS NULL OR u.rol = p_filtro_rol)
    AND (p_filtro_estado IS NULL OR u.estado = p_filtro_estado)
  ORDER BY u.fecha_registro DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.admin_get_users IS 
  'Retorna la lista de usuarios con su correo y conteo total, con paginación y búsqueda. Exclusivo para administradores.';

-- 6.3 RPC: admin_set_user_status
-- Activa o desactiva la cuenta de un usuario con salvaguardas contra auto-desactivación y último admin
CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  p_target_user_id uuid,
  p_nuevo_estado boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid;
  v_target_user record;
  v_active_admins_count bigint;
BEGIN
  -- 1. Verificar sesión activa
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Sesión no válida o no autenticada'
      USING ERRCODE = '28000';
  END IF;

  -- 2. Autorización estricta de administrador
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Serialización de operaciones de estado administrativo
  PERFORM pg_advisory_xact_lock(hashtext('admin_user_status_lock'));

  -- 4. Validar existencia del usuario objetivo
  SELECT id, nombre, rol, estado
  INTO v_target_user
  FROM public.usuarios
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: El usuario especificado no existe'
      USING ERRCODE = 'P0002';
  END IF;

  -- 5. Salvaguarda 1: Protección contra auto-desactivación
  IF p_target_user_id = v_admin_id AND p_nuevo_estado = false THEN
    RAISE EXCEPTION 'CANNOT_DEACTIVATE_SELF: No puedes desactivar tu propia cuenta de administrador'
      USING ERRCODE = '22023';
  END IF;

  -- 6. Salvaguarda 2: Protección contra desactivación del último administrador activo
  IF v_target_user.rol = 'ADMIN' AND p_nuevo_estado = false THEN
    SELECT count(*)
    INTO v_active_admins_count
    FROM public.usuarios
    WHERE rol = 'ADMIN' AND estado = true;

    IF v_active_admins_count <= 1 THEN
      RAISE EXCEPTION 'LAST_ADMIN_PROTECTION: No se puede desactivar al único administrador activo del sistema'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 7. Actualización del estado del usuario
  UPDATE public.usuarios
  SET estado = p_nuevo_estado
  WHERE id = p_target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'usuario_id', p_target_user_id,
    'estado_anterior', v_target_user.estado,
    'nuevo_estado', p_nuevo_estado,
    'modificado_por', v_admin_id,
    'updated_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.admin_set_user_status IS 
  'Activa o desactiva una cuenta de usuario con protecciones contra auto-desactivación y último administrador.';

-- ============================================================================
-- SECCIÓN 7: APLICACIÓN DE RESTRICCIÓN DE CUENTAS INACTIVAS EN OPERACIONES DE NEGOCIO
-- ============================================================================

-- 7.1 Actualizar save_user_preferences_atomic para impedir cambios a usuarios desactivados
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
  v_user_active boolean;
BEGIN
  -- 1. Autenticación
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Sesión no válida o no autenticada'
      USING ERRCODE = '28000';
  END IF;

  -- 1.1 REGLA DE NEGOCIO: Validar que la cuenta esté activa
  SELECT estado INTO v_user_active
  FROM public.usuarios
  WHERE id = v_user_id;

  IF v_user_active IS FALSE THEN
    RAISE EXCEPTION 'ACCOUNT_DISABLED: Esta cuenta se encuentra suspendida o inactiva'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Concurrencia: Bloqueo consultivo transaccional por usuario
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

  -- 7. Upsert en preferencias_usuario
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

-- 7.2 Actualizar políticas de Storage en el bucket 'avatars' para exigir cuenta activa
DROP POLICY IF EXISTS "Subida de avatar propio" ON storage.objects;
CREATE POLICY "Subida de avatar propio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND (SELECT public.is_active_user())
);

DROP POLICY IF EXISTS "Actualizacion de avatar propio" ON storage.objects;
CREATE POLICY "Actualizacion de avatar propio"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND (SELECT public.is_active_user())
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND (SELECT public.is_active_user())
);

-- ============================================================================
-- SECCIÓN 8: PRIVILEGIOS DE EJECUCIÓN MÍNIMOS
-- ============================================================================

-- Revocar privilegios públicos sobre funciones administrativas y de verificación
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_get_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_metrics() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_get_users(text, int, int, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_users(text, int, int, text, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_status(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, boolean) TO authenticated;

-- ============================================================================
-- SECCIÓN 9: PROCEDIMIENTO CONTROLADO PARA DESIGNAR EL PRIMER ADMIN
-- ============================================================================
-- INSTRUCCIONES DE BOOTSTRAPPING PARA EL ADMINISTRADOR DEL SISTEMA:
--
-- Por motivos de seguridad estricta, la migración NO promueve cuentas por correo
-- automáticamente. Para otorgar el rol ADMIN al evaluador o cuenta inicial,
-- ejecutar en el SQL Editor de Supabase:
--
-- DO $$
-- DECLARE
--   v_target_email text := 'profesor_o_admin@dominio.com'; -- <--- REEMPLAZAR AQUÍ
--   v_target_id uuid;
-- BEGIN
--   SELECT id INTO v_target_id FROM auth.users WHERE email = v_target_email;
--   IF v_target_id IS NULL THEN
--     RAISE NOTICE 'No se encontró la cuenta % en auth.users. Asegúrate de que se haya registrado primero.', v_target_email;
--   ELSE
--     UPDATE public.usuarios
--     SET rol = 'ADMIN', estado = true
--     WHERE id = v_target_id;
--     RAISE NOTICE 'Cuenta % promovida exitosamente a ADMIN (ID: %).', v_target_email, v_target_id;
--   END IF;
-- END $$;
-- ============================================================================
