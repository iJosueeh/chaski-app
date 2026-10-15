-- ============================================================================
-- MIGRACIÓN CHASKI: Ampliación de Datos Multimedia para Destinos (Serie AX)
-- Archivo: supabase/migrations/20261014140000_places_multimedia_and_bucket.sql
--
-- Objetivos:
-- 1. Verificar existencia y seguridad de public.is_admin().
-- 2. Crear tabla public.lugares_imagenes con FK CASCADE, checks de formato y orden.
-- 3. Crear restricción de portada única parcial e índice ordenado para evitar redundancia.
-- 4. Habilitar RLS con lectura controlada y escrituras restringidas a administradores.
-- 5. Crear y configurar bucket 'places' en storage.buckets con RLS por rol ADMIN.
-- 6. Crear RPC admin_set_lugar_portada con validación, pertenencia y bloqueo pesimista.
-- 7. Crear tabla de cola y trigger para eliminación recuperable de archivos de Storage.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Verificación defensiva previa de public.is_admin()
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' 
      AND p.proname = 'is_admin'
      AND p.prosecdef = true
  ) THEN
    RAISE EXCEPTION 'CRITICAL: La funcion public.is_admin() con SECURITY DEFINER no existe. Aplique primero la infraestructura de roles antes de continuar.'
      USING ERRCODE = '42883';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Creación de tabla public.lugares_imagenes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lugares_imagenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lugar_id uuid NOT NULL,
  storage_path text NOT NULL,
  es_portada boolean NOT NULL DEFAULT false,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Clave foránea con eliminación en cascada si se borra el destino
  CONSTRAINT fk_lugares_imagenes_lugar 
    FOREIGN KEY (lugar_id) 
    REFERENCES public.lugares(id) 
    ON DELETE CASCADE,

  -- Validación de ruta no vacía
  CONSTRAINT chk_lugares_imagenes_path 
    CHECK (char_length(trim(storage_path)) > 0),

  -- Validación estricta de estructura: {lugar_id}/{uuid}.{ext}
  CONSTRAINT chk_lugares_imagenes_path_format 
    CHECK (storage_path ~* '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$'),

  -- Validación de coherencia de carpeta raíz con el ID del destino
  CONSTRAINT chk_lugares_imagenes_folder_matches_lugar 
    CHECK (storage_path LIKE (lugar_id::text || '/%')),

  -- Orden no negativo
  CONSTRAINT chk_lugares_imagenes_orden 
    CHECK (orden >= 0)
);

COMMENT ON TABLE public.lugares_imagenes IS 
  'Fotografías y recursos multimedia asociados a destinos patrimoniales en Chaski Serie AX.';

-- ----------------------------------------------------------------------------
-- 3. Índices y Restricción Única Parcial (Sin redundancias)
-- ----------------------------------------------------------------------------

-- Garantiza a nivel de motor PostgreSQL como máximo UNA portada activa por lugar.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lugares_imagenes_portada_por_lugar 
ON public.lugares_imagenes (lugar_id) 
WHERE es_portada = true;

-- Índice compuesto para recuperación de galería en orden y cobertura de FK (ON DELETE CASCADE)
CREATE INDEX IF NOT EXISTS idx_lugares_imagenes_lugar_orden 
ON public.lugares_imagenes (lugar_id, orden ASC, created_at ASC);

-- ----------------------------------------------------------------------------
-- 4. Row Level Security (RLS) para public.lugares_imagenes
-- ----------------------------------------------------------------------------
ALTER TABLE public.lugares_imagenes ENABLE ROW LEVEL SECURITY;

-- Lectura:
-- Usuarios anónimos ven imágenes de destinos activos (sin evaluar is_admin para evitar error de permisos).
-- Usuarios autenticados ven imágenes de destinos activos o (si son ADMIN) cualquier destino.
DROP POLICY IF EXISTS "Lectura de imagenes de destinos patrimoniales" ON public.lugares_imagenes;
DROP POLICY IF EXISTS "Lectura publica anonima de destinos activos" ON public.lugares_imagenes;
CREATE POLICY "Lectura publica anonima de destinos activos"
ON public.lugares_imagenes FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.lugares l
    WHERE l.id = lugares_imagenes.lugar_id
      AND l.estado = true
  )
);

DROP POLICY IF EXISTS "Lectura autenticada de destinos" ON public.lugares_imagenes;
CREATE POLICY "Lectura autenticada de destinos"
ON public.lugares_imagenes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lugares l
    WHERE l.id = lugares_imagenes.lugar_id
      AND (l.estado = true OR (SELECT public.is_admin()))
  )
);

-- Inserción: Exclusiva para administradores activos
DROP POLICY IF EXISTS "Insercion de imagenes de destinos solo ADMIN" ON public.lugares_imagenes;
CREATE POLICY "Insercion de imagenes de destinos solo ADMIN"
ON public.lugares_imagenes FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT public.is_admin())
);

-- Actualización: Exclusiva para administradores activos
DROP POLICY IF EXISTS "Actualizacion de imagenes de destinos solo ADMIN" ON public.lugares_imagenes;
CREATE POLICY "Actualizacion de imagenes de destinos solo ADMIN"
ON public.lugares_imagenes FOR UPDATE
TO authenticated
USING (
  (SELECT public.is_admin())
)
WITH CHECK (
  (SELECT public.is_admin())
);

-- Eliminación: Exclusiva para administradores activos
DROP POLICY IF EXISTS "Eliminacion de imagenes de destinos solo ADMIN" ON public.lugares_imagenes;
CREATE POLICY "Eliminacion de imagenes de destinos solo ADMIN"
ON public.lugares_imagenes FOR DELETE
TO authenticated
USING (
  (SELECT public.is_admin())
);

-- Privilegios granulares
REVOKE ALL ON public.lugares_imagenes FROM PUBLIC;
GRANT SELECT ON public.lugares_imagenes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lugares_imagenes TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Bucket 'places' en Supabase Storage y Políticas de Acceso
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'places',
  'places',
  true,
  5242880, -- 5 MB máximo por fotografía
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Lectura pública para visualización en app móvil y web
DROP POLICY IF EXISTS "Lectura publica de storage places" ON storage.objects;
CREATE POLICY "Lectura publica de storage places"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'places');

-- Subida exclusiva para ADMIN
DROP POLICY IF EXISTS "Subida a storage places solo ADMIN" ON storage.objects;
CREATE POLICY "Subida a storage places solo ADMIN"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'places'
  AND (SELECT public.is_admin())
);

-- Actualización exclusiva para ADMIN
DROP POLICY IF EXISTS "Actualizacion en storage places solo ADMIN" ON storage.objects;
CREATE POLICY "Actualizacion en storage places solo ADMIN"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'places'
  AND (SELECT public.is_admin())
)
WITH CHECK (
  bucket_id = 'places'
  AND (SELECT public.is_admin())
);

-- Eliminación física exclusiva para ADMIN
DROP POLICY IF EXISTS "Eliminacion en storage places solo ADMIN" ON storage.objects;
CREATE POLICY "Eliminacion en storage places solo ADMIN"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'places'
  AND (SELECT public.is_admin())
);

-- ----------------------------------------------------------------------------
-- 6. RPC admin_set_lugar_portada con Validación, Pertenencia y Concurrencia
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_lugar_portada(
  p_lugar_id uuid,
  p_imagen_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_img_exists boolean;
BEGIN
  -- 1. Autorización de Administrador Activo
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Concurrencia: Bloqueo pesimista del lugar para serializar cambios de portada
  PERFORM 1 FROM public.lugares WHERE id = p_lugar_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El destino especificado no existe'
      USING ERRCODE = 'P0002';
  END IF;

  -- 3. Validación de existencia y pertenencia estricta de la imagen al lugar
  SELECT EXISTS (
    SELECT 1 FROM public.lugares_imagenes
    WHERE id = p_imagen_id AND lugar_id = p_lugar_id
  ) INTO v_img_exists;

  IF NOT v_img_exists THEN
    RAISE EXCEPTION 'La imagen especificada no existe o no pertenece al destino indicado'
      USING ERRCODE = 'P0002';
  END IF;

  -- 4. Modificación atómica dentro de la transacción
  UPDATE public.lugares_imagenes
  SET es_portada = false
  WHERE lugar_id = p_lugar_id AND es_portada = true;

  UPDATE public.lugares_imagenes
  SET es_portada = true
  WHERE id = p_imagen_id AND lugar_id = p_lugar_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.admin_set_lugar_portada IS 
  'Asigna de forma atómica y segura la imagen de portada de un lugar con bloqueo pesimista y verificación de pertenencia.';

REVOKE EXECUTE ON FUNCTION public.admin_set_lugar_portada(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_lugar_portada(uuid, uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. Estrategia Recuperable contra Huérfanos: Cola de Eliminación de Storage
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lugares_imagenes_eliminadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL,
  bucket_id text NOT NULL DEFAULT 'places',
  lugar_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz
);

COMMENT ON TABLE public.lugares_imagenes_eliminadas IS 
  'Cola de limpieza para eliminar archivos físicos de Storage sin riesgo de huérfanos por fallas de red o cascades.';

CREATE INDEX IF NOT EXISTS idx_lugares_imagenes_eliminadas_pendientes 
ON public.lugares_imagenes_eliminadas (created_at ASC) 
WHERE processed = false;

ALTER TABLE public.lugares_imagenes_eliminadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lugares_imagenes_eliminadas FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON public.lugares_imagenes_eliminadas TO authenticated;

DROP POLICY IF EXISTS "Gestion de cola de limpieza solo ADMIN" ON public.lugares_imagenes_eliminadas;
CREATE POLICY "Gestion de cola de limpieza solo ADMIN"
ON public.lugares_imagenes_eliminadas FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

-- Trigger que registra en cola toda imagen eliminada (incluso por CASCADE)
CREATE OR REPLACE FUNCTION public.trg_queue_deleted_place_image()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.lugares_imagenes_eliminadas (storage_path, bucket_id, lugar_id)
  VALUES (OLD.storage_path, 'places', OLD.lugar_id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_delete_place_image ON public.lugares_imagenes;
CREATE TRIGGER trg_on_delete_place_image
AFTER DELETE ON public.lugares_imagenes
FOR EACH ROW
EXECUTE FUNCTION public.trg_queue_deleted_place_image();

-- Funciones auxiliares para procesar la cola de Storage
DROP FUNCTION IF EXISTS public.admin_get_pending_storage_cleanups(integer);
CREATE OR REPLACE FUNCTION public.admin_get_pending_storage_cleanups(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  storage_path text,
  bucket_id text,
  lugar_id uuid,
  created_at timestamptz,
  is_referenced boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 
    c.id, 
    c.storage_path, 
    c.bucket_id, 
    c.lugar_id, 
    c.created_at,
    EXISTS (
      SELECT 1 FROM public.lugares_imagenes li
      WHERE li.storage_path = c.storage_path
    ) AS is_referenced
  FROM public.lugares_imagenes_eliminadas c
  WHERE c.processed = false
  ORDER BY c.created_at ASC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_storage_cleanup_processed(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: se requieren privilegios de administrador'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.lugares_imagenes_eliminadas
  SET processed = true, processed_at = now()
  WHERE id = p_id AND processed = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_pending_storage_cleanups(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_pending_storage_cleanups(integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_mark_storage_cleanup_processed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_storage_cleanup_processed(uuid) TO authenticated;

COMMIT;
