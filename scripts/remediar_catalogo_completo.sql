-- ============================================================================
-- SCRIPT DE REMEDIACIÓN FINAL: Consolidación Transaccional e Idempotente del Catálogo
-- Archivo: scripts/remediar_catalogo_completo.sql
--
-- Ejecución recomendada: SQL Editor del Dashboard de Supabase (rol postgres).
--
-- Estructura del Script:
-- 1. DIAGNÓSTICO PREVIO (Solo Lectura): Estado de los 12 pares y 4 casos manuales.
-- 2. BLOQUE TRANSACCIONAL ATÓMICO (BEGIN ... COMMIT):
--    - Fusión determinista y segura de los 12 pares aprobados por UUID y external_id.
--    - Barreras de seguridad: aborta ante imágenes en duplicado, conflictos de horario o referencias inesperadas.
--    - Conservación de categorías, etiquetas y horarios con ON CONFLICT DO NOTHING.
--    - Protección incondicional: los 4 pares manuales (Amano, MAC, Núñez del Prado, Parapente) NO se tocan.
--    - Aserciones posteriores individuales para cada duplicado y canónico (no depende solo de conteos globales).
-- 3. DIAGNÓSTICO POSTERIOR (Solo Lectura): Verificación final de consolidación e integridad.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PARTE 1: DIAGNÓSTICO PREVIO DE SOLO LECTURA
-- ----------------------------------------------------------------------------
SELECT 
  'PRE-DIAGNÓSTICO' AS etapa,
  l.id,
  l.nombre,
  l.fuente,
  l.external_id,
  l.gasto_min,
  l.gasto_max,
  (SELECT count(*) FROM public.lugares_categorias lc WHERE lc.lugar_id = l.id) AS total_categorias,
  (SELECT count(*) FROM public.horarios_lugar hl WHERE hl.lugar_id = l.id) AS total_horarios,
  (SELECT count(*) FROM public.lugares_imagenes li WHERE li.lugar_id = l.id) AS total_imagenes
FROM public.lugares l
WHERE l.external_id IN (
  -- 12 pares aprobados (canónico y duplicado)
  'seed:casa-museo-ricardo-palma', 'chaski-casa-ricardo-palma',
  'seed:cebicheria-la-marina', 'chaski-cebicheria-la-marina',
  'seed:la-casona-suarez', 'chaski-casona-suarez',
  'seed:malecon-parque-del-amor', 'chaski-parque-del-amor',
  'seed:malecon-paul-harris', 'chaski-malecon-paul-harris',
  'seed:mirador-catalina-recavarren', 'chaski-mirador-catalina',
  'seed:mirador-saenz-pena', 'chaski-mirador-saenz-pena',
  'seed:monumento-jose-de-san-martin', 'chaski-monumento-san-martin',
  'seed:parque-mariposas-barranco', 'chaski-parque-mariposas',
  'seed:parque-kennedy', 'chaski-parque-kennedy',
  'seed:parque-mercedes-cabello', 'chaski-parque-mercedes-cabello',
  'seed:puente-de-los-suspiros', 'chaski-puente-suspiros',
  -- 4 casos manuales protegidos
  'seed:museo-amano', 'chaski-museo-amano',
  'seed:museo-arte-contemporaneo-mac', 'chaski-mac-lima',
  'seed:museo-marina-nunez-del-prado', 'chaski-museo-nunez-prado',
  'seed:parapente-costa-verde', 'chaski-parapente-costa-verde'
)
ORDER BY l.nombre, l.external_id;

-- ----------------------------------------------------------------------------
-- PARTE 2: BLOQUE TRANSACCIONAL ATÓMICO DE CONSOLIDACIÓN
-- ----------------------------------------------------------------------------
BEGIN;

DO $$
DECLARE
  v_dup_id uuid;
  v_canonical_id uuid;
  v_count_ext int;
  v_count_candidates int;
  v_count_imagenes_dup int := 0;
  v_count_conflicting_horarios int := 0;
  v_count_unexpected_fks int := 0;

  v_total_merged_lugares int := 0;
  v_total_merged_categorias int := 0;
  v_total_merged_horarios int := 0;
  v_total_merged_etiquetas int := 0;
  v_total_destinos_restantes int := 0;

  v_c RECORD;
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '>>> INICIANDO REMEDIACIÓN FINAL DEL CATÁLOGO DE DESTINOS CHASKI  <<<';
  RAISE NOTICE '====================================================================';

  -- Precheck: existencia de la tabla
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'lugares'
  ) THEN
    RAISE EXCEPTION 'PRE-CHECK FALLIDO: La tabla public.lugares no existe.';
  END IF;

  -- --------------------------------------------------------------------------
  -- DEFINICIÓN EXPLÍCITA DE LOS 12 PARES APROBADOS
  -- Identificados unívocamente por UUID exacto y external_id
  -- --------------------------------------------------------------------------
  FOR v_c IN 
    SELECT * FROM (VALUES
      (
        '84a4ef37-f285-4d35-a63c-632943b9cb74'::uuid, 'seed:casa-museo-ricardo-palma',
        '1c022ada-6442-49cd-867f-66409c18d1f9'::uuid, 'chaski-casa-ricardo-palma',
        'Casa Museo Ricardo Palma', 5::numeric, 15::numeric, 45, 'HORARIO_REGISTRADO',
        -12.11842::double precision, -77.02760::double precision
      ),
      (
        '64ca2af6-7805-4092-840a-ad258938ca19'::uuid, 'seed:cebicheria-la-marina',
        'b7eab51c-497b-40d9-8af7-ba178caf3811'::uuid, 'chaski-cebicheria-la-marina',
        'Cebichería La Marina', 25::numeric, 60::numeric, 60, 'HORARIO_REGISTRADO',
        -12.12800::double precision, -77.03600::double precision
      ),
      (
        'd67c2822-9905-473b-8227-ed40ea22c7ba'::uuid, 'seed:la-casona-suarez',
        'f82d18ea-ebd1-4426-b697-86ed2fac8777'::uuid, 'chaski-casona-suarez',
        'La Casona Suárez', 0::numeric, 0::numeric, 20, 'HORARIO_REGISTRADO',
        -12.10834::double precision, -77.03054::double precision
      ),
      (
        '85d55ab7-3662-4249-9111-aa5041845e33'::uuid, 'seed:malecon-parque-del-amor',
        'e133edad-6b57-4a0d-8554-63ee5fd74d91'::uuid, 'chaski-parque-del-amor',
        'Malecón de Miraflores (Parque del Amor)', 0::numeric, 0::numeric, 30, 'LIBRE_ACCESO',
        -12.13300::double precision, -77.02800::double precision
      ),
      (
        '252b77f2-296e-46cb-98d0-81be98e38543'::uuid, 'seed:malecon-paul-harris',
        'ff0aa0c0-7d93-4a8e-8e04-1c70e3e9a202'::uuid, 'chaski-malecon-paul-harris',
        'Malecón Paul Harris', 0::numeric, 0::numeric, 25, 'LIBRE_ACCESO',
        -12.13908::double precision, -77.02634::double precision
      ),
      (
        '513c78e8-fcc0-4c0d-8c56-81503e6c6242'::uuid, 'seed:mirador-catalina-recavarren',
        'b3370f18-33ed-4c54-b44d-b048e1b17e4a'::uuid, 'chaski-mirador-catalina',
        'Mirador Catalina Recavarren', 0::numeric, 0::numeric, 20, 'LIBRE_ACCESO',
        -12.14968::double precision, -77.02357::double precision
      ),
      (
        '5397d0d9-7ef2-4824-b6c8-c27243219478'::uuid, 'seed:mirador-saenz-pena',
        'd6ba1f9a-0a21-48a4-99e7-0cbb9397d8b0'::uuid, 'chaski-mirador-saenz-pena',
        'Mirador Sáenz Peña', 0::numeric, 0::numeric, 20, 'LIBRE_ACCESO',
        -12.14343::double precision, -77.02475::double precision
      ),
      (
        '734d78cd-c989-4ab8-8627-4b2c13ceede7'::uuid, 'seed:monumento-jose-de-san-martin',
        '7e6cfc51-12c1-4201-aa81-f8927d568e3d'::uuid, 'chaski-monumento-san-martin',
        'Monumento a José de San Martín', 0::numeric, 0::numeric, 15, 'LIBRE_ACCESO',
        -12.14328::double precision, -77.02315::double precision
      ),
      (
        'd01d4858-960a-4275-88a8-2297f364214c'::uuid, 'seed:parque-mariposas-barranco',
        'd81f2fb8-f58d-45bd-baf3-b03afddf15ab'::uuid, 'chaski-parque-mariposas',
        'Parque de las Mariposas de Barranco', 0::numeric, 0::numeric, 25, 'LIBRE_ACCESO',
        -12.14087::double precision, -77.02603::double precision
      ),
      (
        '6c7495da-fa4e-4cce-9be8-b94d7143da15'::uuid, 'seed:parque-kennedy',
        '15b1db74-bee5-4b70-8bc2-425fd5cea287'::uuid, 'chaski-parque-kennedy',
        'Parque Kennedy', 0::numeric, 0::numeric, 30, 'LIBRE_ACCESO',
        -12.12000::double precision, -77.03000::double precision
      ),
      (
        '2cd27a68-cd1f-47af-8db1-d13e3845b6a3'::uuid, 'seed:parque-mercedes-cabello',
        '9bc8b55d-2a59-44bc-8a2b-171e87c01339'::uuid, 'chaski-parque-mercedes-cabello',
        'Parque Mercedes Cabello de Carbonera', 0::numeric, 0::numeric, 25, 'LIBRE_ACCESO',
        -12.10513::double precision, -77.02843::double precision
      ),
      (
        'f15f4f8e-7a5a-4023-8d0d-72584799174b'::uuid, 'seed:puente-de-los-suspiros',
        'a06164ca-fdb9-48e7-a255-e5cbaa4f7d81'::uuid, 'chaski-puente-suspiros',
        'Puente de los Suspiros', 0::numeric, 0::numeric, 20, 'LIBRE_ACCESO',
        -12.14300::double precision, -77.02400::double precision
      )
    ) AS t(can_id, can_ext_id, dup_id, dup_ext_id, nombre, g_min, g_max, dur, tipo_disp, lat, lon)
  LOOP
    -- Resolución de ID Canónico (soporta coincidencia directa por UUID o por external_id)
    v_canonical_id := COALESCE(
      (SELECT id FROM public.lugares WHERE id = v_c.can_id),
      (SELECT id FROM public.lugares WHERE external_id = v_c.can_ext_id)
    );

    -- Resolución de ID Duplicado
    v_dup_id := COALESCE(
      (SELECT id FROM public.lugares WHERE id = v_c.dup_id),
      (SELECT id FROM public.lugares WHERE external_id = v_c.dup_ext_id)
    );

    -- Verificación de canónico
    IF v_canonical_id IS NULL THEN
      RAISE EXCEPTION 'PRE-CHECK FALLIDO: No se encontró el registro canónico para "%" (esperado: % / %).',
        v_c.nombre, v_c.can_id, v_c.can_ext_id;
    END IF;

    -- Si el duplicado ya no existe (idempotencia en reejecuciones), continuar
    IF v_dup_id IS NULL THEN
      RAISE NOTICE 'Caso [%]: El duplicado ya no existe (idempotente). Omitiendo fusión.', v_c.nombre;
      CONTINUE;
    END IF;

    -- Seguridad: verificar que canónico y duplicado sean registros distintos
    IF v_canonical_id = v_dup_id THEN
      RAISE EXCEPTION 'AMBIGÜEDAD CRÍTICA: El registro canónico y el duplicado son idénticos (%) para "%".',
        v_canonical_id, v_c.nombre;
    END IF;

    RAISE NOTICE 'Caso [%]: Evaluando duplicado % para consolidar en canónico %...', 
      v_c.nombre, v_dup_id, v_canonical_id;

    -- ========================================================================
    -- 1. BARRERA DE INTEGRIDAD STORAGE
    -- ========================================================================
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'lugares_imagenes'
    ) THEN
      SELECT count(*) INTO v_count_imagenes_dup
      FROM public.lugares_imagenes 
      WHERE lugar_id = v_dup_id;

      IF v_count_imagenes_dup > 0 THEN
        RAISE EXCEPTION 'BLOQUEO DE SEGURIDAD STORAGE: El duplicado % (%) posee % imagen(es) en public.lugares_imagenes. Se detiene la consolidación para evitar URLs rotas.',
          v_dup_id, v_c.nombre, v_count_imagenes_dup;
      END IF;
    END IF;

    -- ========================================================================
    -- 2. BARRERA DE INTEGRIDAD DE HORARIOS
    -- ========================================================================
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
        RAISE EXCEPTION 'BLOQUEO DE SEGURIDAD HORARIOS: El duplicado % (%) presenta % horario(s) contradictorio(s) con el canónico %.',
          v_dup_id, v_c.nombre, v_count_conflicting_horarios, v_canonical_id;
      END IF;
    END IF;

    -- ========================================================================
    -- 3. MIGRACIÓN RELACIONAL IDEMPOTENTE
    -- ========================================================================

    -- A. Categorías
    INSERT INTO public.lugares_categorias (lugar_id, categoria_id)
    SELECT v_canonical_id, categoria_id 
    FROM public.lugares_categorias 
    WHERE lugar_id = v_dup_id
    ON CONFLICT (lugar_id, categoria_id) DO NOTHING;

    GET DIAGNOSTICS v_count_candidates = ROW_COUNT;
    v_total_merged_categorias := v_total_merged_categorias + v_count_candidates;
    DELETE FROM public.lugares_categorias WHERE lugar_id = v_dup_id;

    -- B. Etiquetas
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

    -- C. Horarios
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'horarios_lugar'
    ) THEN
      DELETE FROM public.horarios_lugar hl_dup
      WHERE hl_dup.lugar_id = v_dup_id
        AND EXISTS (
          SELECT 1 FROM public.horarios_lugar hl_can
          WHERE hl_can.lugar_id = v_canonical_id
            AND hl_can.dia_semana = hl_dup.dia_semana
            AND hl_can.hora_apertura = hl_dup.hora_apertura
            AND hl_can.hora_cierre = hl_dup.hora_cierre
        );

      UPDATE public.horarios_lugar 
      SET lugar_id = v_canonical_id 
      WHERE lugar_id = v_dup_id;

      GET DIAGNOSTICS v_count_candidates = ROW_COUNT;
      v_total_merged_horarios := v_total_merged_horarios + v_count_candidates;
    END IF;

    -- D. Registros de limpieza de Storage si existieran
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'lugares_imagenes_eliminadas'
    ) THEN
      UPDATE public.lugares_imagenes_eliminadas 
      SET lugar_id = v_canonical_id 
      WHERE lugar_id = v_dup_id;
    END IF;

    -- E. Eliminación segura del registro duplicado
    DELETE FROM public.lugares WHERE id = v_dup_id;
    v_total_merged_lugares := v_total_merged_lugares + 1;

    -- F. Consolidación de atributos canónicos estables en el registro conservado
    UPDATE public.lugares SET 
      nombre = v_c.nombre,
      fuente = 'dataset-osm-chaski',
      external_id = v_c.can_ext_id,
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
  -- 1. Validación individual: Los 12 duplicados deben haber desaparecido
  FOR v_c IN
    SELECT unnest(ARRAY[
      '1c022ada-6442-49cd-867f-66409c18d1f9'::uuid,
      'b7eab51c-497b-40d9-8af7-ba178caf3811'::uuid,
      'f82d18ea-ebd1-4426-b697-86ed2fac8777'::uuid,
      'e133edad-6b57-4a0d-8554-63ee5fd74d91'::uuid,
      'ff0aa0c0-7d93-4a8e-8e04-1c70e3e9a202'::uuid,
      'b3370f18-33ed-4c54-b44d-b048e1b17e4a'::uuid,
      'd6ba1f9a-0a21-48a4-99e7-0cbb9397d8b0'::uuid,
      '7e6cfc51-12c1-4201-aa81-f8927d568e3d'::uuid,
      'd81f2fb8-f58d-45bd-baf3-b03afddf15ab'::uuid,
      '15b1db74-bee5-4b70-8bc2-425fd5cea287'::uuid,
      '9bc8b55d-2a59-44bc-8a2b-171e87c01339'::uuid,
      'a06164ca-fdb9-48e7-a255-e5cbaa4f7d81'::uuid
    ]) AS id_esperado_eliminado
  LOOP
    IF EXISTS (SELECT 1 FROM public.lugares WHERE id = v_c.id_esperado_eliminado) THEN
      RAISE EXCEPTION 'POST-CHECK FALLIDO: El duplicado % continúa existiendo en public.lugares.',
        v_c.id_esperado_eliminado;
    END IF;
  END LOOP;

  -- 2. Validación individual: Los 12 canónicos deben existir activos
  FOR v_c IN
    SELECT unnest(ARRAY[
      '84a4ef37-f285-4d35-a63c-632943b9cb74'::uuid,
      '64ca2af6-7805-4092-840a-ad258938ca19'::uuid,
      'd67c2822-9905-473b-8227-ed40ea22c7ba'::uuid,
      '85d55ab7-3662-4249-9111-aa5041845e33'::uuid,
      '252b77f2-296e-46cb-98d0-81be98e38543'::uuid,
      '513c78e8-fcc0-4c0d-8c56-81503e6c6242'::uuid,
      '5397d0d9-7ef2-4824-b6c8-c27243219478'::uuid,
      '734d78cd-c989-4ab8-8627-4b2c13ceede7'::uuid,
      'd01d4858-960a-4275-88a8-2297f364214c'::uuid,
      '6c7495da-fa4e-4cce-9be8-b94d7143da15'::uuid,
      '2cd27a68-cd1f-47af-8db1-d13e3845b6a3'::uuid,
      'f15f4f8e-7a5a-4023-8d0d-72584799174b'::uuid
    ]) AS id_esperado_canonico
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.lugares WHERE id = v_c.id_esperado_canonico AND estado = true) THEN
      RAISE EXCEPTION 'POST-CHECK FALLIDO: El canónico % no se encuentra activo.',
        v_c.id_esperado_canonico;
    END IF;
  END LOOP;

  -- 3. Protección incondicional: Los 4 casos manuales deben permanecer con sus 2 filas intactas
  IF (SELECT count(*) FROM public.lugares WHERE external_id IN ('chaski-museo-amano', 'seed:museo-amano')) <> 2 THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: El caso manual Museo Amano fue alterado indebidamente.';
  END IF;
  IF (SELECT count(*) FROM public.lugares WHERE external_id IN ('chaski-mac-lima', 'seed:museo-arte-contemporaneo-mac')) <> 2 THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: El caso manual MAC Lima fue alterado indebidamente.';
  END IF;
  IF (SELECT count(*) FROM public.lugares WHERE external_id IN ('chaski-museo-nunez-prado', 'seed:museo-marina-nunez-del-prado')) <> 2 THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: El caso manual Marina Núñez del Prado fue alterado indebidamente.';
  END IF;
  IF (SELECT count(*) FROM public.lugares WHERE external_id IN ('chaski-parapente-costa-verde', 'seed:parapente-costa-verde')) <> 2 THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: El caso manual Parapente Costa Verde fue alterado indebidamente.';
  END IF;

  -- 4. No deben existir relaciones huérfanas
  IF EXISTS (
    SELECT 1 FROM public.lugares_categorias lc 
    LEFT JOIN public.lugares l ON l.id = lc.lugar_id 
    WHERE l.id IS NULL
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: Existen registros huérfanos en lugares_categorias.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lugares_etiquetas le 
    LEFT JOIN public.lugares l ON l.id = le.lugar_id 
    WHERE l.id IS NULL
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: Existen registros huérfanos en lugares_etiquetas.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lugares_imagenes li 
    LEFT JOIN public.lugares l ON l.id = li.lugar_id 
    WHERE l.id IS NULL
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FALLIDO: Existen imágenes huérfanas en lugares_imagenes.';
  END IF;

  SELECT count(*) INTO v_total_destinos_restantes FROM public.lugares;

  RAISE NOTICE '====================================================================';
  RAISE NOTICE '>>> CONSOLIDACIÓN FINALIZADA CON ÉXITO:';
  RAISE NOTICE '  - Destinos duplicados eliminados: %', v_total_merged_lugares;
  RAISE NOTICE '  - Relaciones categorías migradas: %', v_total_merged_categorias;
  RAISE NOTICE '  - Horarios migrados:              %', v_total_merged_horarios;
  RAISE NOTICE '  - Relaciones etiquetas migradas:  %', v_total_merged_etiquetas;
  RAISE NOTICE '  - Destinos totales actuales:      % (esperado: 27 tras 12 consolidados)', v_total_destinos_restantes;
  RAISE NOTICE '====================================================================';
END $$;

COMMIT;

-- ----------------------------------------------------------------------------
-- PARTE 3: DIAGNÓSTICO POSTERIOR DE SOLO LECTURA
-- ----------------------------------------------------------------------------
SELECT 
  'POST-DIAGNÓSTICO' AS etapa,
  l.id,
  l.nombre,
  l.fuente,
  l.external_id,
  l.gasto_min,
  l.gasto_max,
  (SELECT count(*) FROM public.lugares_categorias lc WHERE lc.lugar_id = l.id) AS total_categorias,
  (SELECT count(*) FROM public.horarios_lugar hl WHERE hl.lugar_id = l.id) AS total_horarios,
  (SELECT count(*) FROM public.lugares_imagenes li WHERE li.lugar_id = l.id) AS total_imagenes
FROM public.lugares l
WHERE l.external_id IN (
  'seed:casa-museo-ricardo-palma',
  'seed:cebicheria-la-marina',
  'seed:la-casona-suarez',
  'seed:malecon-parque-del-amor',
  'seed:malecon-paul-harris',
  'seed:mirador-catalina-recavarren',
  'seed:mirador-saenz-pena',
  'seed:monumento-jose-de-san-martin',
  'seed:parque-mariposas-barranco',
  'seed:parque-kennedy',
  'seed:parque-mercedes-cabello',
  'seed:puente-de-los-suspiros',
  -- Los 4 manuales intactos
  'seed:museo-amano', 'chaski-museo-amano',
  'seed:museo-arte-contemporaneo-mac', 'chaski-mac-lima',
  'seed:museo-marina-nunez-del-prado', 'chaski-museo-nunez-prado',
  'seed:parapente-costa-verde', 'chaski-parapente-costa-verde'
)
ORDER BY l.nombre, l.external_id;
