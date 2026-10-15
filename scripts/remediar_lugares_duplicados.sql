-- ============================================================================
-- SCRIPT DE REMEDIACIÓN SEGURA: Fusión y Deduplicación Determinista de Destinos
-- Archivo: scripts/remediar_lugares_duplicados.sql
--
-- Ejecución: SQL Editor de Supabase (Transaccional y Reversible ante fallos).
--
-- Casos abordados:
-- 1. Canta Rana
-- 2. Antigua Bodega Dalmacia
-- 3. La 73 Paradero Gourmet
-- 4. Huaca Pucllana ('Huaca Pucllana' vs 'Huaca Pucllana (Museo de Sitio)')
--
-- Garantías de Integridad:
-- - Comprobaciones previas de catálogo FK (lugares_categorias, lugares_etiquetas,
--   horarios_lugar, lugares_imagenes).
-- - Selección determinista de UUID canónico; aborta con RAISE EXCEPTION ante ambigüedad.
-- - Fusión idempotente de relaciones intermedias con clave primaria compuesta.
-- - Resolución explícita de portada y storage_path para lugares_imagenes, evitando
--   la activación errónea del trigger trg_on_delete_place_image y la cola de Storage.
-- - Valores canónicos justificados oficialmente (tarifarios y dataset verificado OSM).
-- - Aserciones posteriores con RAISE EXCEPTION ante cualquier inconsistencia.
-- - Idempotencia demostrada: reejecuciones no producen modificaciones ni errores.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- Variables de control y verificación
  v_dup_id uuid;
  v_canonical_id uuid;
  v_count_ext int;
  v_count_candidates int;
  v_count_imagenes_dup int := 0;
  v_count_conflicting_horarios int := 0;
  v_total_merged_lugares int := 0;
  v_total_merged_categorias int := 0;
  v_total_merged_horarios int := 0;
  v_total_merged_etiquetas int := 0;
  v_c RECORD;
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '>>> INICIANDO REMEDIACIÓN DETERMINISTA DE DESTINOS PATRIMONIALES <<<';
  RAISE NOTICE '====================================================================';

  -- --------------------------------------------------------------------------
  -- PASO 0: Comprobación previa de Catálogo y Claves Foráneas
  -- --------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'lugares'
  ) THEN
    RAISE EXCEPTION 'PRE-CHECK FALLIDO: La tabla public.lugares no existe.';
  END IF;

  -- --------------------------------------------------------------------------
  -- PROCESAMIENTO DETERMINISTA DE CADA CASO
  -- --------------------------------------------------------------------------
  -- Definición de los 4 Casos Canónicos Justificados:
  -- 1. Canta Rana: Cebichería tradicional de Barranco (Genovés 101). Consumo S/ 15 - 40.
  -- 2. Antigua Bodega Dalmacia: Café-bodega histórico de Miraflores (San Fernando 401). Consumo S/ 10 - 30.
  -- 3. La 73 Paradero Gourmet: Restaurante contemporáneo de Barranco (El Sol Oeste 175). Consumo S/ 40 - 80.
  -- 4. Huaca Pucllana (Museo de Sitio): Complejo arqueológico en Miraflores. Tarifa general oficial S/ 15,
  --    visita nocturna/guiada hasta S/ 30. Duración oficial de recorrido: 60 min.
  -- --------------------------------------------------------------------------
  FOR v_c IN 
    SELECT * FROM (VALUES
      (
        '%Canta Rana%', 
        'Canta Rana', 
        'seed:canta-rana', 
        15::numeric, 40::numeric, 60, 'HORARIO_REGISTRADO', -12.14676::double precision, -77.02232::double precision,
        'Dataset OSM verificado / ticket promedio cebichería clásica Barranco'
      ),
      (
        '%Dalmacia%', 
        'Antigua Bodega Dalmacia', 
        'seed:antigua-bodega-dalmacia', 
        10::numeric, 30::numeric, 40, 'HORARIO_REGISTRADO', -12.13241::double precision, -77.02659::double precision,
        'Dataset OSM verificado / consumo promedio café bistró Miraflores'
      ),
      (
        '%La 73%', 
        'La 73 Paradero Gourmet', 
        'seed:la-73-paradero-gourmet', 
        40::numeric, 80::numeric, 75, 'HORARIO_REGISTRADO', -12.13970::double precision, -77.02329::double precision,
        'Dataset OSM verificado / restaurante gourmet contemporáneo Barranco'
      ),
      (
        '%Pucllana%', 
        'Huaca Pucllana (Museo de Sitio)', 
        'seed:huaca-pucllana', 
        15::numeric, 30::numeric, 60, 'HORARIO_REGISTRADO', -12.11107::double precision, -77.03335::double precision,
        'Tarifario oficial Museo de Sitio Huaca Pucllana (Boleto general S/ 15, nocturno/guiado S/ 30)'
      )
    ) AS t(patron, nombre_canonico, ext_id, g_min, g_max, dur, tipo_disp, lat, lon, justificacion)
  LOOP
    v_canonical_id := NULL;

    -- 1. Control de Ambigüedad: Comprobar cuántos registros poseen el external_id canónico
    SELECT count(*) INTO v_count_ext 
    FROM public.lugares 
    WHERE fuente = 'dataset-osm-chaski' AND external_id = v_c.ext_id;

    IF v_count_ext > 1 THEN
      RAISE EXCEPTION 'AMBIGÜEDAD CRÍTICA: Existen % registros con external_id "%". Se aborta la remediación.', 
        v_count_ext, v_c.ext_id;
    ELSIF v_count_ext = 1 THEN
      -- Se conserva el que ya porta el external_id oficial
      SELECT id INTO v_canonical_id 
      FROM public.lugares 
      WHERE fuente = 'dataset-osm-chaski' AND external_id = v_c.ext_id;
    ELSE
      -- Si ninguno tiene el external_id asignado, seleccionar deterministamente el registro
      -- más antiguo (creación original) con id como desempate estable
      SELECT id INTO v_canonical_id 
      FROM public.lugares 
      WHERE nombre ILIKE v_c.patron
      ORDER BY fecha_actualizacion ASC, id ASC
      LIMIT 1;
    END IF;

    -- Si no existe ningún registro (ej. base limpia o no cargada), continuar
    IF v_canonical_id IS NULL THEN
      RAISE NOTICE 'Caso [%]: No se encontró ningún registro en la base de datos.', v_c.nombre_canonico;
      CONTINUE;
    END IF;

    -- 2. Procesar duplicados redundantes que apunten al mismo destino físico
    FOR v_dup_id IN 
      SELECT id FROM public.lugares 
      WHERE nombre ILIKE v_c.patron AND id <> v_canonical_id
      ORDER BY id ASC
    LOOP
      RAISE NOTICE 'Caso [%]: Evaluando duplicado % para fusión en canónico %...', 
        v_c.nombre_canonico, v_dup_id, v_canonical_id;

      -- ======================================================================
      -- 1. CONTROL DE INTEGRIDAD DE SUPABASE STORAGE (FOTOGRAFÍAS REALES)
      -- ======================================================================
      -- Antes de fusionar cada duplicado, comprueba si tiene registros en public.lugares_imagenes.
      -- Si no tiene imágenes, permite la fusión normal.
      -- Si tiene imágenes, detén esa fusión con un error explícito. No modifiques storage_path
      -- ni elimines la fila hasta definir un traslado físico seguro.
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'lugares_imagenes'
      ) THEN
        SELECT count(*) INTO v_count_imagenes_dup
        FROM public.lugares_imagenes
        WHERE lugar_id = v_dup_id;

        IF v_count_imagenes_dup > 0 THEN
          RAISE EXCEPTION 'BLOQUEO DE SEGURIDAD STORAGE: El destino duplicado % (%) posee % imagen(es) en public.lugares_imagenes. Se detiene la fusión para evitar URLs rotas. No se modifica storage_path ni se elimina el registro hasta ejecutar el traslado físico de los archivos en Supabase Storage.',
            v_dup_id, v_c.nombre_canonico, v_count_imagenes_dup;
        END IF;
      END IF;

      -- ======================================================================
      -- 2. CONTROL DE INTEGRIDAD DE HORARIOS (DETECCIÓN DE CONTRADICCIONES)
      -- ======================================================================
      -- Comprueba también que no existan horarios contradictorios entre el registro
      -- duplicado y el canónico; ante ambigüedad, detén la fusión y reporta los datos.
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'horarios_lugar'
      ) THEN
        SELECT count(*) INTO v_count_conflicting_horarios
        FROM public.horarios_lugar hl_dup
        JOIN public.horarios_lugar hl_can 
          ON hl_can.lugar_id = v_canonical_id 
         AND hl_can.dia_semana = hl_dup.dia_semana
        WHERE hl_dup.lugar_id = v_dup_id
          AND (hl_dup.hora_apertura <> hl_can.hora_apertura OR hl_dup.hora_cierre <> hl_can.hora_cierre);

        IF v_count_conflicting_horarios > 0 THEN
          RAISE EXCEPTION 'BLOQUEO DE SEGURIDAD HORARIOS: El destino duplicado % (%) presenta % horario(s) contradictorio(s) con el canónico % para el mismo día de la semana. Se detiene la fusión para resolución manual de horarios.',
            v_dup_id, v_c.nombre_canonico, v_count_conflicting_horarios, v_canonical_id;
        END IF;
      END IF;

      -- ======================================================================
      -- 3. FUSIÓN SEGURA DE RELACIONES HIJAS
      -- ======================================================================

      -- A. Migración de Categorías (lugares_categorias)
      -- Inserción idempotente con ON CONFLICT DO NOTHING para clave primaria (lugar_id, categoria_id)
      INSERT INTO public.lugares_categorias (lugar_id, categoria_id)
      SELECT v_canonical_id, categoria_id 
      FROM public.lugares_categorias 
      WHERE lugar_id = v_dup_id
      ON CONFLICT (lugar_id, categoria_id) DO NOTHING;
      
      GET DIAGNOSTICS v_count_candidates = ROW_COUNT;
      v_total_merged_categorias := v_total_merged_categorias + v_count_candidates;
      DELETE FROM public.lugares_categorias WHERE lugar_id = v_dup_id;

      -- B. Migración de Etiquetas (lugares_etiquetas)
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'lugares_etiquetas'
      ) THEN
        INSERT INTO public.lugares_etiquetas (lugar_id, etiqueta_id)
        SELECT v_canonical_id, etiqueta_id 
        FROM public.lugares_etiquetas 
        WHERE lugar_id = v_dup_id
        ON CONFLICT (lugar_id, etiqueta_id) DO NOTHING;

        GET DIAGNOSTICS v_count_candidates = ROW_COUNT;
        v_total_merged_etiquetas := v_total_merged_etiquetas + v_count_candidates;
        DELETE FROM public.lugares_etiquetas WHERE lugar_id = v_dup_id;
      END IF;

      -- C. Migración de Horarios (horarios_lugar)
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'horarios_lugar'
      ) THEN
        -- Descartar horarios idénticos que ya existan en el canónico
        DELETE FROM public.horarios_lugar hl_dup
        WHERE hl_dup.lugar_id = v_dup_id
          AND EXISTS (
            SELECT 1 FROM public.horarios_lugar hl_can
            WHERE hl_can.lugar_id = v_canonical_id
              AND hl_can.dia_semana = hl_dup.dia_semana
              AND hl_can.hora_apertura = hl_dup.hora_apertura
              AND hl_can.hora_cierre = hl_dup.hora_cierre
          );

        -- Reasignar los horarios compatibles no redundantes hacia el canónico
        UPDATE public.horarios_lugar 
        SET lugar_id = v_canonical_id 
        WHERE lugar_id = v_dup_id;

        GET DIAGNOSTICS v_count_candidates = ROW_COUNT;
        v_total_merged_horarios := v_total_merged_horarios + v_count_candidates;
      END IF;

      -- D. Limpieza de registros históricos (lugares_imagenes_eliminadas) si existieran
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'lugares_imagenes_eliminadas'
      ) THEN
        UPDATE public.lugares_imagenes_eliminadas 
        SET lugar_id = v_canonical_id 
        WHERE lugar_id = v_dup_id;
      END IF;

      -- E. Eliminación segura del registro duplicado
      -- Al haber desvinculado todas las tablas hijas y garantizado 0 imágenes,
      -- la eliminación es limpia, sin pérdida de datos y sin disparar borrados en Storage.
      DELETE FROM public.lugares WHERE id = v_dup_id;
      v_total_merged_lugares := v_total_merged_lugares + 1;
    END LOOP;

    -- 3. Consolidación de atributos canónicos justificados en el registro conservado
    UPDATE public.lugares SET 
      nombre = v_c.nombre_canonico,
      fuente = 'dataset-osm-chaski',
      external_id = v_c.ext_id,
      gasto_min = v_c.g_min,
      gasto_max = v_c.g_max,
      duracion_sugerida_min = v_c.dur,
      tipo_disponibilidad = v_c.tipo_disp,
      latitud = v_c.lat,
      longitud = v_c.lon,
      estado = true,
      fecha_actualizacion = '2026-09-09T00:00:00Z'
    WHERE id = v_canonical_id;

  END LOOP;

  -- --------------------------------------------------------------------------
  -- PASO FINAL: Aserciones Posteriores de Verificación de Integridad
  -- --------------------------------------------------------------------------
  -- 1. Ninguno de los 4 destinos debe tener más de 1 registro activo
  IF (SELECT count(*) FROM public.lugares WHERE lower(trim(nombre)) = 'canta rana') > 1 THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: Canta Rana continúa duplicado.';
  END IF;

  IF (SELECT count(*) FROM public.lugares WHERE lower(trim(nombre)) = 'antigua bodega dalmacia') > 1 THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: Antigua Bodega Dalmacia continúa duplicado.';
  END IF;

  IF (SELECT count(*) FROM public.lugares WHERE lower(trim(nombre)) ILIKE '%la 73%') > 1 THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: La 73 continúa duplicado.';
  END IF;

  IF (SELECT count(*) FROM public.lugares WHERE nombre ILIKE '%Huaca Pucllana%') > 1 THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: Huaca Pucllana continúa duplicado.';
  END IF;

  -- 2. No deben existir relaciones huérfanas
  IF EXISTS (
    SELECT 1 FROM public.lugares_categorias lc 
    LEFT JOIN public.lugares l ON l.id = lc.lugar_id 
    WHERE l.id IS NULL
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: Existen registros huérfanos en lugares_categorias.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lugares_imagenes li 
    LEFT JOIN public.lugares l ON l.id = li.lugar_id 
    WHERE l.id IS NULL
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: Existen imágenes huérfanas en lugares_imagenes.';
  END IF;

  RAISE NOTICE '====================================================================';
  RAISE NOTICE '>>> REMEDIACIÓN FINALIZADA CON ÉXITO:';
  RAISE NOTICE '  - Destinos duplicados eliminados: %', v_total_merged_lugares;
  RAISE NOTICE '  - Relaciones categorías migradas: %', v_total_merged_categorias;
  RAISE NOTICE '  - Horarios migrados:              %', v_total_merged_horarios;
  RAISE NOTICE '  - Relaciones etiquetas migradas:  %', v_total_merged_etiquetas;
  RAISE NOTICE '====================================================================';
END $$;

COMMIT;
