-- ============================================================================
-- SCRIPT DE DIAGNÓSTICO: Inspección Forense de Lugares y Duplicados
-- Archivo: scripts/diagnostico_lugares_remotos.sql
-- Ejecución: Solo lectura (Seguro para ejecutar en Supabase SQL Editor).
-- ============================================================================

-- 1. Resumen de registros específicos afectados (los 4 casos reportados)
SELECT 
  l.id,
  l.nombre,
  l.fuente,
  l.external_id,
  l.gasto_min,
  l.gasto_max,
  l.duracion_sugerida_min,
  l.latitud,
  l.longitud,
  l.tipo_disponibilidad,
  l.estado,
  l.fecha_actualizacion,
  (SELECT count(*) FROM public.lugares_categorias lc WHERE lc.lugar_id = l.id) AS total_categorias,
  (SELECT count(*) FROM public.lugares_imagenes li WHERE li.lugar_id = l.id) AS total_imagenes,
  (SELECT count(*) FROM public.horarios_lugar hl WHERE hl.lugar_id = l.id) AS total_horarios,
  (SELECT count(*) FROM public.lugares_etiquetas le WHERE le.lugar_id = l.id) AS total_etiquetas
FROM public.lugares l
WHERE l.nombre ILIKE '%Pucllana%'
   OR l.nombre ILIKE '%Canta Rana%'
   OR l.nombre ILIKE '%Dalmacia%'
   OR l.nombre ILIKE '%La 73%'
ORDER BY 
  CASE 
    WHEN l.nombre ILIKE '%Pucllana%' THEN 1
    WHEN l.nombre ILIKE '%Canta Rana%' THEN 2
    WHEN l.nombre ILIKE '%Dalmacia%' THEN 3
    ELSE 4
  END,
  (l.external_id IS NOT NULL) DESC,
  l.fecha_actualizacion ASC;

-- 2. Detección de cualquier otro posible duplicado por nombre normalizado
SELECT 
  lower(trim(regexp_replace(nombre, '\(.*?\)', '', 'g'))) AS nombre_raiz,
  count(*) AS total_registros,
  array_agg(id) AS ids_registrados,
  array_agg(nombre) AS nombres_exactos,
  array_agg(external_id) AS external_ids
FROM public.lugares
GROUP BY lower(trim(regexp_replace(nombre, '\(.*?\)', '', 'g')))
HAVING count(*) > 1;
