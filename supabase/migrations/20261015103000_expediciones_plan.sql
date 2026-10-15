-- ============================================================================
-- MIGRACIÓN CHASKI: Historial de Expediciones con Paradas Visitadas (Serie AX)
-- Archivo: supabase/migrations/20261015103000_expediciones_plan.sql
--
-- Objetivos:
-- 1. Persistir el resultado de cada expedición (1:1 con su solicitud) para
--    que «Mis Exploraciones» muestre estado y paradas visitadas desde BD.
-- 2. Conservar el plan generado tal cual se ofreció al usuario (snapshot
--    jsonb), para reconstruir el itinerario aunque `lugares` cambie después.
-- 3. Evitar duplicados: PK sobre solicitud_id + upsert desde la app.
-- 4. Aislar datos por usuario mediante RLS (usuario_id = auth.uid()).
-- 5. Garantizar que el usuario de la expedición coincida con el de la
--    solicitud mediante FK compuesta (solicitud_id, usuario_id).
-- 6. Reservar el estado 'EN_CURSO' para una fase 2 (progreso en vivo).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Unicidad de (id, usuario_id) en solicitudes_plan (base de la FK compuesta)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'solicitudes_plan_id_usuario_key'
  ) THEN
    ALTER TABLE public.solicitudes_plan
      ADD CONSTRAINT solicitudes_plan_id_usuario_key UNIQUE (id, usuario_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Tabla de expediciones (resultado de ejecución de un plan)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expediciones_plan (
  solicitud_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  estado_expedicion text NOT NULL,
  completado_en timestamp with time zone NOT NULL DEFAULT now(),
  plan_snapshot jsonb NOT NULL,
  paradas_visitadas smallint[] NOT NULL DEFAULT '{}'::smallint[],
  paradas_visitadas_ids text[] NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT expediciones_plan_pkey PRIMARY KEY (solicitud_id),
  CONSTRAINT expediciones_plan_solicitud_fk
    FOREIGN KEY (solicitud_id, usuario_id)
    REFERENCES public.solicitudes_plan (id, usuario_id)
    ON DELETE CASCADE,
  CONSTRAINT expediciones_plan_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES public.usuarios (id),
  CONSTRAINT expediciones_plan_estado_check
    CHECK (estado_expedicion IN ('EN_CURSO', 'COMPLETADA', 'PARCIAL', 'ABANDONADA'))
);

CREATE INDEX IF NOT EXISTS expediciones_plan_usuario_id_idx
  ON public.expediciones_plan (usuario_id);

CREATE INDEX IF NOT EXISTS expediciones_plan_completado_en_idx
  ON public.expediciones_plan (completado_en DESC);

-- ----------------------------------------------------------------------------
-- 3. Row Level Security (RLS) para public.expediciones_plan
-- ----------------------------------------------------------------------------
ALTER TABLE public.expediciones_plan ENABLE ROW LEVEL SECURITY;

-- Lectura: solo las expediciones propias
DROP POLICY IF EXISTS "Lectura de expediciones propias" ON public.expediciones_plan;
CREATE POLICY "Lectura de expediciones propias"
ON public.expediciones_plan FOR SELECT
TO authenticated
USING (usuario_id = (SELECT auth.uid()));

-- Inserción: solo filas propias (el usuario coincide con el de la solicitud por la FK)
DROP POLICY IF EXISTS "Insercion de expediciones propias" ON public.expediciones_plan;
CREATE POLICY "Insercion de expediciones propias"
ON public.expediciones_plan FOR INSERT
TO authenticated
WITH CHECK (usuario_id = (SELECT auth.uid()));

-- Actualización: solo filas propias (necesaria para el upsert por solicitud_id)
DROP POLICY IF EXISTS "Actualizacion de expediciones propias" ON public.expediciones_plan;
CREATE POLICY "Actualizacion de expediciones propias"
ON public.expediciones_plan FOR UPDATE
TO authenticated
USING (usuario_id = (SELECT auth.uid()))
WITH CHECK (usuario_id = (SELECT auth.uid()));

-- Eliminación: solo filas propias (habilita un futuro «limpiar historial» sincronizado)
DROP POLICY IF EXISTS "Eliminacion de expediciones propias" ON public.expediciones_plan;
CREATE POLICY "Eliminacion de expediciones propias"
ON public.expediciones_plan FOR DELETE
TO authenticated
USING (usuario_id = (SELECT auth.uid()));

-- Privilegios granulares
REVOKE ALL ON public.expediciones_plan FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expediciones_plan TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Verificación (ejecutar con una sesión autenticada de prueba)
-- ----------------------------------------------------------------------------
-- INSERT de una expedición propia debe funcionar:
--   INSERT INTO public.expediciones_plan
--     (solicitud_id, usuario_id, estado_expedicion, plan_snapshot)
--   VALUES ('<solicitud propia>', auth.uid(), 'COMPLETADA', '{}'::jsonb);
--
-- SELECT debe devolver solo filas propias:
--   SELECT * FROM public.expediciones_plan;
--
-- Upsert idempotente (completar dos veces no duplica):
--   INSERT INTO public.expediciones_plan
--     (solicitud_id, usuario_id, estado_expedicion, plan_snapshot)
--   VALUES ('<solicitud propia>', auth.uid(), 'PARCIAL', '{}'::jsonb)
--   ON CONFLICT (solicitud_id)
--   DO UPDATE SET estado_expedicion = excluded.estado_expedicion;
