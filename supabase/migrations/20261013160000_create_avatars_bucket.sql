-- ============================================================================
-- MIGRACIÓN CHASKI: Bucket de Avatares y Políticas RLS (Serie AX)
-- Archivo: supabase/migrations/20261013160000_create_avatars_bucket.sql
--
-- Regla de Negocio:
-- Cada usuario puede tener como máximo un avatar vigente en Supabase Storage.
-- No existe historial de fotos ni galería pública para imágenes anteriores.
-- Las fotos se almacenan en carpetas aisladas por auth.uid().
-- ============================================================================

-- 1. Crear bucket de avatares público con límite de 2 MB y tipos mime permitidos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Política de lectura pública: cualquier usuario puede consultar avatares
DROP POLICY IF EXISTS "Avatares publicos de exploradores" ON storage.objects;
CREATE POLICY "Avatares publicos de exploradores"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 3. Política de inserción: usuario autenticado solo en su propia subcarpeta
DROP POLICY IF EXISTS "Subida de avatar propio" ON storage.objects;
CREATE POLICY "Subida de avatar propio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- 4. Política de actualización/reemplazo: usuario autenticado solo en su propia subcarpeta
DROP POLICY IF EXISTS "Actualizacion de avatar propio" ON storage.objects;
CREATE POLICY "Actualizacion de avatar propio"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- 5. Política de eliminación: usuario autenticado solo en su propia subcarpeta
DROP POLICY IF EXISTS "Eliminacion de avatar propio" ON storage.objects;
CREATE POLICY "Eliminacion de avatar propio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
