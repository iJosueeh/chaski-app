-- ============================================================================
-- MIGRACIÓN CHASKI: Restricciones e Índices de Idempotencia para Destinos
-- Archivo: supabase/migrations/20261014150000_places_idempotency_constraints.sql
--
-- Objetivos:
-- 1. Garantizar unicidad parcial en public.lugares por (fuente, external_id) cuando external_id no es nulo.
-- 2. Añadir índice de soporte FK en public.lugares_categorias(categoria_id) para optimización de joins.
-- 3. Añadir índice compuesto en public.lugares(estado, tipo_disponibilidad) para optimizar getActivePlaces.
--
-- NOTA: Se omiten restricciones UNIQUE redundantes en categorias.nombre y
-- lugares_categorias(lugar_id, categoria_id) por ya estar cubiertas por el esquema existente.
-- Se omite UNIQUE global en lugares.nombre para evitar bloqueos ante homónimos o actualizaciones.
-- ============================================================================

BEGIN;

-- 1. Unicidad parcial de Lugares por (fuente, external_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_lugares_fuente_external_id 
  ON public.lugares (fuente, external_id) 
  WHERE external_id IS NOT NULL;

-- 2. Índice de soporte FK para categoria_id en lugares_categorias
CREATE INDEX IF NOT EXISTS idx_lugares_categorias_categoria_id 
  ON public.lugares_categorias (categoria_id);

-- 3. Índice de soporte para consultas de catálogo y destinos activos por régimen
CREATE INDEX IF NOT EXISTS idx_lugares_estado_tipo_disp 
  ON public.lugares (estado, tipo_disponibilidad);

COMMIT;
