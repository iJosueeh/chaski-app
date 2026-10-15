-- ============================================================================
-- SCRIPT SEED: Población Idempotente de Destinos Iniciales Chaski
-- Archivo: scripts/seed_lugares.sql
-- Ejecutable directamente en el SQL Editor de Supabase (rol postgres).
-- ============================================================================
BEGIN;

-- 1. Categorías
INSERT INTO public.categorias (id, nombre, icono) VALUES (COALESCE((SELECT id FROM public.categorias WHERE lower(trim(nombre)) = lower(trim('Cultura'))), gen_random_uuid()), 'Cultura', 'culture') ON CONFLICT (nombre) DO UPDATE SET icono = EXCLUDED.icono;
INSERT INTO public.categorias (id, nombre, icono) VALUES (COALESCE((SELECT id FROM public.categorias WHERE lower(trim(nombre)) = lower(trim('Miradores'))), gen_random_uuid()), 'Miradores', 'viewpoint') ON CONFLICT (nombre) DO UPDATE SET icono = EXCLUDED.icono;
INSERT INTO public.categorias (id, nombre, icono) VALUES (COALESCE((SELECT id FROM public.categorias WHERE lower(trim(nombre)) = lower(trim('Parques'))), gen_random_uuid()), 'Parques', 'park') ON CONFLICT (nombre) DO UPDATE SET icono = EXCLUDED.icono;
INSERT INTO public.categorias (id, nombre, icono) VALUES (COALESCE((SELECT id FROM public.categorias WHERE lower(trim(nombre)) = lower(trim('Atracciones'))), gen_random_uuid()), 'Atracciones', 'attraction') ON CONFLICT (nombre) DO UPDATE SET icono = EXCLUDED.icono;
INSERT INTO public.categorias (id, nombre, icono) VALUES (COALESCE((SELECT id FROM public.categorias WHERE lower(trim(nombre)) = lower(trim('Historia'))), gen_random_uuid()), 'Historia', 'monument') ON CONFLICT (nombre) DO UPDATE SET icono = EXCLUDED.icono;
INSERT INTO public.categorias (id, nombre, icono) VALUES (COALESCE((SELECT id FROM public.categorias WHERE lower(trim(nombre)) = lower(trim('Gastronomía'))), gen_random_uuid()), 'Gastronomía', 'gastronomy') ON CONFLICT (nombre) DO UPDATE SET icono = EXCLUDED.icono;

-- 2. Destinos (lugares)

-- 2. Destinos (lugares) con resolución previa de duplicados
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:huaca-pucllana')      OR lower(trim(nombre)) = lower(trim('Huaca Pucllana (Museo de Sitio)'))      OR (lower(trim(nombre)) LIKE lower(trim('Huaca Pucllana%')) AND abs(latitud - (-12.11107)) < 0.002 AND abs(longitud - (-77.03335)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Huaca Pucllana (Museo de Sitio)',       descripcion = 'Templo ceremonial preinca de barro (200-700 d.C.) en pleno Miraflores. Icono arqueológico de Lima.',       latitud = -12.11107,       longitud = -77.03335,       gasto_min = 15,       gasto_max = 30,       duracion_sugerida_min = 60,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:huaca-pucllana',       tipo_disponibilidad = 'HORARIO_REGISTRADO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Huaca Pucllana (Museo de Sitio)', 'Templo ceremonial preinca de barro (200-700 d.C.) en pleno Miraflores. Icono arqueológico de Lima.', NULL, -12.11107, -77.03335, 15, 30, 60, true, 'dataset-osm-chaski', 'seed:huaca-pucllana', 'HORARIO_REGISTRADO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:museo-amano')      OR lower(trim(nombre)) = lower(trim('Museo Amano (Textil Precolombino)'))      OR (lower(trim(nombre)) LIKE lower(trim('Museo Amano%')) AND abs(latitud - (-12.11406)) < 0.002 AND abs(longitud - (-77.04077)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Museo Amano (Textil Precolombino)',       descripcion = 'Colección privada de textiles de las culturas Chancay, Paracas y Huari.',       latitud = -12.11406,       longitud = -77.04077,       gasto_min = 10,       gasto_max = 25,       duracion_sugerida_min = 60,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:museo-amano',       tipo_disponibilidad = 'HORARIO_REGISTRADO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Museo Amano (Textil Precolombino)', 'Colección privada de textiles de las culturas Chancay, Paracas y Huari.', NULL, -12.11406, -77.04077, 10, 25, 60, true, 'dataset-osm-chaski', 'seed:museo-amano', 'HORARIO_REGISTRADO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:casa-museo-ricardo-palma')      OR lower(trim(nombre)) = lower(trim('Casa Museo Ricardo Palma'))      OR (lower(trim(nombre)) LIKE lower(trim('Casa Museo Ricardo Palma%')) AND abs(latitud - (-12.11842)) < 0.002 AND abs(longitud - (-77.0276)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Casa Museo Ricardo Palma',       descripcion = 'Casa donde vivió el escritor Ricardo Palma, autor de Tradiciones Peruanas.',       latitud = -12.11842,       longitud = -77.0276,       gasto_min = 5,       gasto_max = 15,       duracion_sugerida_min = 45,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:casa-museo-ricardo-palma',       tipo_disponibilidad = 'HORARIO_REGISTRADO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Casa Museo Ricardo Palma', 'Casa donde vivió el escritor Ricardo Palma, autor de Tradiciones Peruanas.', NULL, -12.11842, -77.0276, 5, 15, 45, true, 'dataset-osm-chaski', 'seed:casa-museo-ricardo-palma', 'HORARIO_REGISTRADO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:museo-marina-nunez-del-prado')      OR lower(trim(nombre)) = lower(trim('Museo Marina Núñez del Prado'))      OR (lower(trim(nombre)) LIKE lower(trim('Museo Marina Núñez del Prado%')) AND abs(latitud - (-12.10106)) < 0.002 AND abs(longitud - (-77.034)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Museo Marina Núñez del Prado',       descripcion = 'Museo de la escultora boliviana Marina Núñez del Prado, arte abstracto andino.',       latitud = -12.10106,       longitud = -77.034,       gasto_min = 0,       gasto_max = 10,       duracion_sugerida_min = 40,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:museo-marina-nunez-del-prado',       tipo_disponibilidad = 'HORARIO_REGISTRADO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Museo Marina Núñez del Prado', 'Museo de la escultora boliviana Marina Núñez del Prado, arte abstracto andino.', NULL, -12.10106, -77.034, 0, 10, 40, true, 'dataset-osm-chaski', 'seed:museo-marina-nunez-del-prado', 'HORARIO_REGISTRADO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:museo-arte-contemporaneo-mac')      OR lower(trim(nombre)) = lower(trim('Museo de Arte Contemporáneo (MAC)'))      OR (lower(trim(nombre)) LIKE lower(trim('Museo de Arte Contemporáneo%')) AND abs(latitud - (-12.127)) < 0.002 AND abs(longitud - (-77.033)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Museo de Arte Contemporáneo (MAC)',       descripcion = 'Museo de arte contemporáneo peruano con exposiciones temporales.',       latitud = -12.127,       longitud = -77.033,       gasto_min = 15,       gasto_max = 30,       duracion_sugerida_min = 60,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:museo-arte-contemporaneo-mac',       tipo_disponibilidad = 'HORARIO_REGISTRADO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Museo de Arte Contemporáneo (MAC)', 'Museo de arte contemporáneo peruano con exposiciones temporales.', NULL, -12.127, -77.033, 15, 30, 60, true, 'dataset-osm-chaski', 'seed:museo-arte-contemporaneo-mac', 'HORARIO_REGISTRADO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:malecon-parque-del-amor')      OR lower(trim(nombre)) = lower(trim('Malecón de Miraflores (Parque del Amor)'))      OR (lower(trim(nombre)) LIKE lower(trim('Malecón de Miraflores%')) AND abs(latitud - (-12.133)) < 0.002 AND abs(longitud - (-77.028)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Malecón de Miraflores (Parque del Amor)',       descripcion = 'Parque con mosaico del beso y vistas panorámicas al Pacífico. Preferido al atardecer.',       latitud = -12.133,       longitud = -77.028,       gasto_min = 0,       gasto_max = 0,       duracion_sugerida_min = 30,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:malecon-parque-del-amor',       tipo_disponibilidad = 'LIBRE_ACCESO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Malecón de Miraflores (Parque del Amor)', 'Parque con mosaico del beso y vistas panorámicas al Pacífico. Preferido al atardecer.', NULL, -12.133, -77.028, 0, 0, 30, true, 'dataset-osm-chaski', 'seed:malecon-parque-del-amor', 'LIBRE_ACCESO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:malecon-paul-harris')      OR lower(trim(nombre)) = lower(trim('Malecón Paul Harris'))      OR (lower(trim(nombre)) LIKE lower(trim('Malecón Paul Harris%')) AND abs(latitud - (-12.13908)) < 0.002 AND abs(longitud - (-77.02634)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Malecón Paul Harris',       descripcion = 'Mirador sobre el acantilado con vista al mar y a las playas de Barranco.',       latitud = -12.13908,       longitud = -77.02634,       gasto_min = 0,       gasto_max = 0,       duracion_sugerida_min = 25,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:malecon-paul-harris',       tipo_disponibilidad = 'LIBRE_ACCESO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Malecón Paul Harris', 'Mirador sobre el acantilado con vista al mar y a las playas de Barranco.', NULL, -12.13908, -77.02634, 0, 0, 25, true, 'dataset-osm-chaski', 'seed:malecon-paul-harris', 'LIBRE_ACCESO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:mirador-catalina-recavarren')      OR lower(trim(nombre)) = lower(trim('Mirador Catalina Recavarren'))      OR (lower(trim(nombre)) LIKE lower(trim('Mirador Catalina Recavarren%')) AND abs(latitud - (-12.14968)) < 0.002 AND abs(longitud - (-77.02357)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Mirador Catalina Recavarren',       descripcion = 'Punto de observación de parapentes y vista al océano en la Costa Verde.',       latitud = -12.14968,       longitud = -77.02357,       gasto_min = 0,       gasto_max = 0,       duracion_sugerida_min = 20,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:mirador-catalina-recavarren',       tipo_disponibilidad = 'LIBRE_ACCESO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Mirador Catalina Recavarren', 'Punto de observación de parapentes y vista al océano en la Costa Verde.', NULL, -12.14968, -77.02357, 0, 0, 20, true, 'dataset-osm-chaski', 'seed:mirador-catalina-recavarren', 'LIBRE_ACCESO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:mirador-saenz-pena')      OR lower(trim(nombre)) = lower(trim('Mirador Sáenz Peña'))      OR (lower(trim(nombre)) LIKE lower(trim('Mirador Sáenz Peña%')) AND abs(latitud - (-12.14343)) < 0.002 AND abs(longitud - (-77.02475)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Mirador Sáenz Peña',       descripcion = 'Mirador en el malecón de Barranco con vista a la bahía y al acantilado.',       latitud = -12.14343,       longitud = -77.02475,       gasto_min = 0,       gasto_max = 0,       duracion_sugerida_min = 20,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:mirador-saenz-pena',       tipo_disponibilidad = 'LIBRE_ACCESO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Mirador Sáenz Peña', 'Mirador en el malecón de Barranco con vista a la bahía y al acantilado.', NULL, -12.14343, -77.02475, 0, 0, 20, true, 'dataset-osm-chaski', 'seed:mirador-saenz-pena', 'LIBRE_ACCESO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:parque-kennedy')      OR lower(trim(nombre)) = lower(trim('Parque Kennedy'))      OR (lower(trim(nombre)) LIKE lower(trim('Parque Kennedy%')) AND abs(latitud - (-12.12)) < 0.002 AND abs(longitud - (-77.03)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Parque Kennedy',       descripcion = 'El parque central de Miraflores, con decenas de gatos, cultura viva y comercios aledaños.',       latitud = -12.12,       longitud = -77.03,       gasto_min = 0,       gasto_max = 0,       duracion_sugerida_min = 30,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:parque-kennedy',       tipo_disponibilidad = 'LIBRE_ACCESO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Parque Kennedy', 'El parque central de Miraflores, con decenas de gatos, cultura viva y comercios aledaños.', NULL, -12.12, -77.03, 0, 0, 30, true, 'dataset-osm-chaski', 'seed:parque-kennedy', 'LIBRE_ACCESO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:parque-mariposas-barranco')      OR lower(trim(nombre)) = lower(trim('Parque de las Mariposas de Barranco'))      OR (lower(trim(nombre)) LIKE lower(trim('Parque de las Mariposas de Barranco%')) AND abs(latitud - (-12.14087)) < 0.002 AND abs(longitud - (-77.02603)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Parque de las Mariposas de Barranco',       descripcion = 'Parque temático con mariposario y senderos de Barranco.',       latitud = -12.14087,       longitud = -77.02603,       gasto_min = 0,       gasto_max = 0,       duracion_sugerida_min = 25,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:parque-mariposas-barranco',       tipo_disponibilidad = 'LIBRE_ACCESO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Parque de las Mariposas de Barranco', 'Parque temático con mariposario y senderos de Barranco.', NULL, -12.14087, -77.02603, 0, 0, 25, true, 'dataset-osm-chaski', 'seed:parque-mariposas-barranco', 'LIBRE_ACCESO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:parque-mercedes-cabello')      OR lower(trim(nombre)) = lower(trim('Parque Mercedes Cabello de Carbonera'))      OR (lower(trim(nombre)) LIKE lower(trim('Parque Mercedes Cabello de Carbonera%')) AND abs(latitud - (-12.10513)) < 0.002 AND abs(longitud - (-77.02843)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Parque Mercedes Cabello de Carbonera',       descripcion = 'Parque residencial en Miraflores con área recreativa y vegetación.',       latitud = -12.10513,       longitud = -77.02843,       gasto_min = 0,       gasto_max = 0,       duracion_sugerida_min = 25,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:parque-mercedes-cabello',       tipo_disponibilidad = 'LIBRE_ACCESO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Parque Mercedes Cabello de Carbonera', 'Parque residencial en Miraflores con área recreativa y vegetación.', NULL, -12.10513, -77.02843, 0, 0, 25, true, 'dataset-osm-chaski', 'seed:parque-mercedes-cabello', 'LIBRE_ACCESO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:puente-de-los-suspiros')      OR lower(trim(nombre)) = lower(trim('Puente de los Suspiros'))      OR (lower(trim(nombre)) LIKE lower(trim('Puente de los Suspiros%')) AND abs(latitud - (-12.143)) < 0.002 AND abs(longitud - (-77.024)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Puente de los Suspiros',       descripcion = 'Puente de madera de Barranco (1876). Tradición: cruzar sin respirar para pedir un deseo.',       latitud = -12.143,       longitud = -77.024,       gasto_min = 0,       gasto_max = 0,       duracion_sugerida_min = 20,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:puente-de-los-suspiros',       tipo_disponibilidad = 'LIBRE_ACCESO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Puente de los Suspiros', 'Puente de madera de Barranco (1876). Tradición: cruzar sin respirar para pedir un deseo.', NULL, -12.143, -77.024, 0, 0, 20, true, 'dataset-osm-chaski', 'seed:puente-de-los-suspiros', 'LIBRE_ACCESO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:parapente-costa-verde')      OR lower(trim(nombre)) = lower(trim('Parapente (Paragliding) Costa Verde'))      OR (lower(trim(nombre)) LIKE lower(trim('Parapente%')) AND abs(latitud - (-12.12589)) < 0.002 AND abs(longitud - (-77.03744)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Parapente (Paragliding) Costa Verde',       descripcion = 'Vuelo en parapente sobre la Costa Verde desde el Malecón de Miraflores.',       latitud = -12.12589,       longitud = -77.03744,       gasto_min = 30,       gasto_max = 40,       duracion_sugerida_min = 45,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:parapente-costa-verde',       tipo_disponibilidad = 'HORARIO_REGISTRADO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Parapente (Paragliding) Costa Verde', 'Vuelo en parapente sobre la Costa Verde desde el Malecón de Miraflores.', NULL, -12.12589, -77.03744, 30, 40, 45, true, 'dataset-osm-chaski', 'seed:parapente-costa-verde', 'HORARIO_REGISTRADO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:la-casona-suarez')      OR lower(trim(nombre)) = lower(trim('La Casona Suárez'))      OR (lower(trim(nombre)) LIKE lower(trim('La Casona Suárez%')) AND abs(latitud - (-12.10834)) < 0.002 AND abs(longitud - (-77.03054)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'La Casona Suárez',       descripcion = 'Casona histórica de estilo republicano en Miraflores.',       latitud = -12.10834,       longitud = -77.03054,       gasto_min = 0,       gasto_max = 0,       duracion_sugerida_min = 20,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:la-casona-suarez',       tipo_disponibilidad = 'HORARIO_REGISTRADO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('La Casona Suárez', 'Casona histórica de estilo republicano en Miraflores.', NULL, -12.10834, -77.03054, 0, 0, 20, true, 'dataset-osm-chaski', 'seed:la-casona-suarez', 'HORARIO_REGISTRADO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:monumento-jose-de-san-martin')      OR lower(trim(nombre)) = lower(trim('Monumento a José de San Martín'))      OR (lower(trim(nombre)) LIKE lower(trim('Monumento a José de San Martín%')) AND abs(latitud - (-12.14328)) < 0.002 AND abs(longitud - (-77.02315)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Monumento a José de San Martín',       descripcion = 'Monumento al libertador José de San Martín, en la bajada a Barranco.',       latitud = -12.14328,       longitud = -77.02315,       gasto_min = 0,       gasto_max = 0,       duracion_sugerida_min = 15,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:monumento-jose-de-san-martin',       tipo_disponibilidad = 'LIBRE_ACCESO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Monumento a José de San Martín', 'Monumento al libertador José de San Martín, en la bajada a Barranco.', NULL, -12.14328, -77.02315, 0, 0, 15, true, 'dataset-osm-chaski', 'seed:monumento-jose-de-san-martin', 'LIBRE_ACCESO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:cebicheria-la-marina')      OR lower(trim(nombre)) = lower(trim('Cebichería La Marina'))      OR (lower(trim(nombre)) LIKE lower(trim('Cebichería La Marina%')) AND abs(latitud - (-12.128)) < 0.002 AND abs(longitud - (-77.036)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Cebichería La Marina',       descripcion = 'Cebichería de mariscos frescos con ceviche tradicional limeño.',       latitud = -12.128,       longitud = -77.036,       gasto_min = 25,       gasto_max = 60,       duracion_sugerida_min = 60,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:cebicheria-la-marina',       tipo_disponibilidad = 'HORARIO_REGISTRADO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Cebichería La Marina', 'Cebichería de mariscos frescos con ceviche tradicional limeño.', NULL, -12.128, -77.036, 25, 60, 60, true, 'dataset-osm-chaski', 'seed:cebicheria-la-marina', 'HORARIO_REGISTRADO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:canta-rana')      OR lower(trim(nombre)) = lower(trim('Canta Rana'))      OR (lower(trim(nombre)) LIKE lower(trim('Canta Rana%')) AND abs(latitud - (-12.14676)) < 0.002 AND abs(longitud - (-77.02232)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Canta Rana',       descripcion = 'Cebichería clásica de Barranco, famosa por su ceviche y ambiente tradicional.',       latitud = -12.14676,       longitud = -77.02232,       gasto_min = 15,       gasto_max = 40,       duracion_sugerida_min = 60,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:canta-rana',       tipo_disponibilidad = 'HORARIO_REGISTRADO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Canta Rana', 'Cebichería clásica de Barranco, famosa por su ceviche y ambiente tradicional.', NULL, -12.14676, -77.02232, 15, 40, 60, true, 'dataset-osm-chaski', 'seed:canta-rana', 'HORARIO_REGISTRADO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:antigua-bodega-dalmacia')      OR lower(trim(nombre)) = lower(trim('Antigua Bodega Dalmacia'))      OR (lower(trim(nombre)) LIKE lower(trim('Antigua Bodega Dalmacia%')) AND abs(latitud - (-12.13241)) < 0.002 AND abs(longitud - (-77.02659)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'Antigua Bodega Dalmacia',       descripcion = 'Bodega-café histórico de Miraflores con ambiente bohemio y pisco.',       latitud = -12.13241,       longitud = -77.02659,       gasto_min = 10,       gasto_max = 30,       duracion_sugerida_min = 40,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:antigua-bodega-dalmacia',       tipo_disponibilidad = 'HORARIO_REGISTRADO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('Antigua Bodega Dalmacia', 'Bodega-café histórico de Miraflores con ambiente bohemio y pisco.', NULL, -12.13241, -77.02659, 10, 30, 40, true, 'dataset-osm-chaski', 'seed:antigua-bodega-dalmacia', 'HORARIO_REGISTRADO', '2026-09-09T00:00:00Z');
  END IF;
END $$;
DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.lugares   WHERE (fuente = 'dataset-osm-chaski' AND external_id = 'seed:la-73-paradero-gourmet')      OR lower(trim(nombre)) = lower(trim('La 73 Paradero Gourmet'))      OR (lower(trim(nombre)) LIKE lower(trim('La 73 Paradero Gourmet%')) AND abs(latitud - (-12.1397)) < 0.002 AND abs(longitud - (-77.02329)) < 0.002)   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lugares SET       nombre = 'La 73 Paradero Gourmet',       descripcion = 'Opción gastronómica contemporánea en Barranco.',       latitud = -12.1397,       longitud = -77.02329,       gasto_min = 40,       gasto_max = 80,       duracion_sugerida_min = 75,       estado = true,       fuente = 'dataset-osm-chaski',       external_id = 'seed:la-73-paradero-gourmet',       tipo_disponibilidad = 'HORARIO_REGISTRADO'     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion)     VALUES ('La 73 Paradero Gourmet', 'Opción gastronómica contemporánea en Barranco.', NULL, -12.1397, -77.02329, 40, 80, 75, true, 'dataset-osm-chaski', 'seed:la-73-paradero-gourmet', 'HORARIO_REGISTRADO', '2026-09-09T00:00:00Z');
  END IF;
END $$;

-- 3. Relaciones lugares_categorias
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Huaca Pucllana (Museo de Sitio)' AND c.nombre = 'Cultura' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Museo Amano (Textil Precolombino)' AND c.nombre = 'Cultura' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Casa Museo Ricardo Palma' AND c.nombre = 'Cultura' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Museo Marina Núñez del Prado' AND c.nombre = 'Cultura' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Museo de Arte Contemporáneo (MAC)' AND c.nombre = 'Cultura' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Malecón de Miraflores (Parque del Amor)' AND c.nombre = 'Miradores' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Malecón Paul Harris' AND c.nombre = 'Miradores' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Mirador Catalina Recavarren' AND c.nombre = 'Miradores' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Mirador Sáenz Peña' AND c.nombre = 'Miradores' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Parque Kennedy' AND c.nombre = 'Parques' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Parque de las Mariposas de Barranco' AND c.nombre = 'Parques' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Parque Mercedes Cabello de Carbonera' AND c.nombre = 'Parques' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Puente de los Suspiros' AND c.nombre = 'Atracciones' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Parapente (Paragliding) Costa Verde' AND c.nombre = 'Atracciones' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'La Casona Suárez' AND c.nombre = 'Atracciones' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Monumento a José de San Martín' AND c.nombre = 'Historia' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Cebichería La Marina' AND c.nombre = 'Gastronomía' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Canta Rana' AND c.nombre = 'Gastronomía' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'Antigua Bodega Dalmacia' AND c.nombre = 'Gastronomía' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
INSERT INTO public.lugares_categorias (lugar_id, categoria_id) SELECT l.id, c.id FROM public.lugares l, public.categorias c WHERE l.nombre = 'La 73 Paradero Gourmet' AND c.nombre = 'Gastronomía' ON CONFLICT (lugar_id, categoria_id) DO NOTHING;

COMMIT;
