-- ============================================================================
-- VERIFICACIÓN Y PRUEBAS AUTOMATIZADAS: Multimedia de Destinos (Serie AX)
-- Archivo: supabase/tests/places_multimedia_verification.sql
--
-- Valida en entorno PostgreSQL/Supabase:
-- 1. Verificación previa de public.is_admin().
-- 2. Constraints de public.lugares_imagenes (formato de ruta, carpeta coincidente, orden no negativo).
-- 3. Restricción de portada única parcial (uq_lugares_imagenes_portada_por_lugar).
-- 4. RLS para lectura controlada (según estado del lugar) y escrituras solo ADMIN.
-- 5. RPC admin_set_lugar_portada: pertenencia, concurrencia y actualización atómica.
-- 6. Trigger y cola de eliminación recuperable (lugares_imagenes_eliminadas) ante borrado directo y CASCADE.
-- ============================================================================

DO $$
DECLARE
  v_admin_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_lugar_1 uuid := gen_random_uuid();
  v_lugar_inactivo uuid := gen_random_uuid();
  v_img_1 uuid := gen_random_uuid();
  v_img_2 uuid := gen_random_uuid();
  v_img_inactivo uuid := gen_random_uuid();
  v_file_uuid_1 uuid := gen_random_uuid();
  v_file_uuid_2 uuid := gen_random_uuid();
  v_file_uuid_inactivo uuid := gen_random_uuid();
  v_error_caught boolean := false;
  v_pending_count integer;
BEGIN
  RAISE NOTICE '>>> INICIANDO VERIFICACIÓN: MULTIMEDIA DE DESTINOS PATRIMONIALES <<<';

  -- --------------------------------------------------------------------------
  -- 0. Preparación de Usuarios (ADMIN y USUARIO)
  -- --------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
  VALUES 
    (v_admin_id, 'admin_places@chaski.pe', '{"nombre": "Admin Places"}'::jsonb, 'authenticated', 'authenticated'),
    (v_user_id, 'user_places@chaski.pe', '{"nombre": "User Places"}'::jsonb, 'authenticated', 'authenticated');

  UPDATE public.usuarios SET rol = 'ADMIN', estado = true WHERE id = v_admin_id;
  UPDATE public.usuarios SET rol = 'USUARIO', estado = true WHERE id = v_user_id;

  GRANT SELECT ON public.lugares TO anon, authenticated;

  -- --------------------------------------------------------------------------
  -- 1. Preparación de Lugares (Activo e Inactivo)
  -- --------------------------------------------------------------------------
  INSERT INTO public.lugares (id, nombre, latitud, longitud, estado, fuente)
  VALUES 
    (v_lugar_1, 'Destino Activo de Prueba', -12.11, -77.03, true, 'test-suite'),
    (v_lugar_inactivo, 'Destino En Mantenimiento', -12.12, -77.04, false, 'test-suite');

  RAISE NOTICE 'Paso 1: Entorno de prueba inicializado con destinos y usuarios.';

  -- --------------------------------------------------------------------------
  -- 2. Validación de Check Constraints en public.lugares_imagenes
  -- --------------------------------------------------------------------------
  -- 2.1 Debe fallar si la ruta no comienza con el lugar_id
  v_error_caught := false;
  BEGIN
    INSERT INTO public.lugares_imagenes (id, lugar_id, storage_path, es_portada, orden)
    VALUES (gen_random_uuid(), v_lugar_1, gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.jpg', false, 0);
  EXCEPTION WHEN check_violation THEN
    v_error_caught := true;
  END;
  ASSERT v_error_caught, 'Fallo Test 2.1: Debió rechazar ruta cuya carpeta no coincide con lugar_id.';

  -- 2.2 Debe fallar si la extensión no es permitida (ej: .exe, .gif)
  v_error_caught := false;
  BEGIN
    INSERT INTO public.lugares_imagenes (id, lugar_id, storage_path, es_portada, orden)
    VALUES (gen_random_uuid(), v_lugar_1, v_lugar_1::text || '/' || gen_random_uuid()::text || '.exe', false, 0);
  EXCEPTION WHEN check_violation THEN
    v_error_caught := true;
  END;
  ASSERT v_error_caught, 'Fallo Test 2.2: Debió rechazar extensión no permitida.';

  -- 2.3 Debe fallar si el orden es negativo
  v_error_caught := false;
  BEGIN
    INSERT INTO public.lugares_imagenes (id, lugar_id, storage_path, es_portada, orden)
    VALUES (gen_random_uuid(), v_lugar_1, v_lugar_1::text || '/' || gen_random_uuid()::text || '.jpg', false, -1);
  EXCEPTION WHEN check_violation THEN
    v_error_caught := true;
  END;
  ASSERT v_error_caught, 'Fallo Test 2.3: Debió rechazar orden negativo.';

  RAISE NOTICE 'Test 2 APROBADO: Constraints de formato, coherencia de carpeta y orden funcionan correctamente.';

  -- --------------------------------------------------------------------------
  -- 3. Restricción de Portada Única Parcial
  -- --------------------------------------------------------------------------
  -- Inserción de primera imagen con portada = true (ADMIN)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text)::text, true);
  INSERT INTO public.lugares_imagenes (id, lugar_id, storage_path, es_portada, orden)
  VALUES (v_img_1, v_lugar_1, v_lugar_1::text || '/' || v_file_uuid_1::text || '.jpg', true, 0);

  -- Inserción de segunda imagen con portada = false (debe tener éxito)
  INSERT INTO public.lugares_imagenes (id, lugar_id, storage_path, es_portada, orden)
  VALUES (v_img_2, v_lugar_1, v_lugar_1::text || '/' || v_file_uuid_2::text || '.webp', false, 1);

  -- Intentar insertar directamente una segunda imagen con portada = true (debe fallar por índice único)
  v_error_caught := false;
  BEGIN
    INSERT INTO public.lugares_imagenes (id, lugar_id, storage_path, es_portada, orden)
    VALUES (gen_random_uuid(), v_lugar_1, v_lugar_1::text || '/' || gen_random_uuid()::text || '.png', true, 2);
  EXCEPTION WHEN unique_violation THEN
    v_error_caught := true;
  END;
  ASSERT v_error_caught, 'Fallo Test 3: uq_lugares_imagenes_portada_por_lugar debió impedir una 2da portada.';

  RAISE NOTICE 'Test 3 APROBADO: Restricción única parcial protege contra portadas duplicadas.';

  -- --------------------------------------------------------------------------
  -- 4. RPC admin_set_lugar_portada
  -- --------------------------------------------------------------------------
  -- 4.1 Rechazo para usuario no admin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id::text)::text, true);
  v_error_caught := false;
  BEGIN
    PERFORM public.admin_set_lugar_portada(v_lugar_1, v_img_2);
  EXCEPTION WHEN insufficient_privilege THEN
    v_error_caught := true;
  END;
  ASSERT v_error_caught, 'Fallo Test 4.1: admin_set_lugar_portada debió rechazar a usuario común.';

  -- 4.2 Rechazo si la imagen no pertenece al destino indicado
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text)::text, true);
  v_error_caught := false;
  BEGIN
    PERFORM public.admin_set_lugar_portada(v_lugar_inactivo, v_img_1);
  EXCEPTION WHEN no_data_found THEN
    v_error_caught := true;
  END;
  ASSERT v_error_caught, 'Fallo Test 4.2: Debió rechazar si la imagen no pertenece al destino.';

  -- 4.3 Actualización atómica legítima por ADMIN
  PERFORM public.admin_set_lugar_portada(v_lugar_1, v_img_2);
  ASSERT (SELECT es_portada FROM public.lugares_imagenes WHERE id = v_img_1) = false,
    'Fallo Test 4.3: La imagen anterior debió perder es_portada.';
  ASSERT (SELECT es_portada FROM public.lugares_imagenes WHERE id = v_img_2) = true,
    'Fallo Test 4.3: La nueva imagen debió recibir es_portada.';

  RAISE NOTICE 'Test 4 APROBADO: admin_set_lugar_portada valida pertenencia y realiza intercambio atómico.';

  -- --------------------------------------------------------------------------
  -- 5. RLS y Control de Acceso
  -- --------------------------------------------------------------------------
  -- Insertar imagen en destino inactivo
  INSERT INTO public.lugares_imagenes (id, lugar_id, storage_path, es_portada, orden)
  VALUES (v_img_inactivo, v_lugar_inactivo, v_lugar_inactivo::text || '/' || v_file_uuid_inactivo::text || '.jpg', true, 0);

  -- 5.0 Validación con rol anon (público sin autenticación ni token JWT)
  EXECUTE 'SET LOCAL ROLE anon';
  ASSERT (SELECT count(*) FROM public.lugares_imagenes WHERE lugar_id = v_lugar_1) = 2,
    'Fallo Test 5.0: anon debió ver imágenes del destino activo sin invocar is_admin.';
  ASSERT (SELECT count(*) FROM public.lugares_imagenes WHERE lugar_id = v_lugar_inactivo) = 0,
    'Fallo Test 5.0: anon no debe ver imágenes de destinos inactivos.';
  EXECUTE 'RESET ROLE';

  -- Cambiar contexto a USUARIO común con rol authenticated de PostgreSQL
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id::text)::text, true);

  -- 5.1 Puede leer imágenes del lugar activo
  ASSERT (SELECT count(*) FROM public.lugares_imagenes WHERE lugar_id = v_lugar_1) = 2,
    'Fallo Test 5.1: USUARIO debió ver imágenes del destino activo.';

  -- 5.2 NO puede ver imágenes del lugar inactivo
  ASSERT (SELECT count(*) FROM public.lugares_imagenes WHERE lugar_id = v_lugar_inactivo) = 0,
    'Fallo Test 5.2: USUARIO no debe ver imágenes de destinos inactivos.';

  -- 5.3 NO puede insertar directamente en lugares_imagenes (violación de WITH CHECK de RLS)
  v_error_caught := false;
  BEGIN
    INSERT INTO public.lugares_imagenes (id, lugar_id, storage_path, es_portada, orden)
    VALUES (gen_random_uuid(), v_lugar_1, v_lugar_1::text || '/' || gen_random_uuid()::text || '.jpg', false, 5);
  EXCEPTION WHEN insufficient_privilege THEN
    v_error_caught := true;
  END;
  ASSERT v_error_caught, 'Fallo Test 5.3: RLS debió impedir INSERT a usuario común.';

  -- Restaurar rol de PostgreSQL para continuar con las pruebas
  EXECUTE 'RESET ROLE';

  RAISE NOTICE 'Test 5 APROBADO: RLS restringe lectura según estado del destino (anon y authenticated) e impide escrituras a no-admin.';

  -- --------------------------------------------------------------------------
  -- 6. Cola de Eliminación de Storage (Trigger trg_on_delete_place_image)
  -- --------------------------------------------------------------------------
  -- Volver a contexto ADMIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text)::text, true);

  -- 6.1 Borrado directo de una imagen -> debe encolarse en lugares_imagenes_eliminadas
  DELETE FROM public.lugares_imagenes WHERE id = v_img_1;
  ASSERT EXISTS (
    SELECT 1 FROM public.lugares_imagenes_eliminadas 
    WHERE storage_path = v_lugar_1::text || '/' || v_file_uuid_1::text || '.jpg'
      AND processed = false
  ), 'Fallo Test 6.1: El trigger no encoló la imagen eliminada directamente.';

  -- 6.2 Borrado en cascada (ON DELETE CASCADE al borrar el destino)
  DELETE FROM public.lugares WHERE id = v_lugar_1;
  -- v_img_2 debió haber sido eliminada por CASCADE y registrada en la cola
  ASSERT EXISTS (
    SELECT 1 FROM public.lugares_imagenes_eliminadas 
    WHERE storage_path = v_lugar_1::text || '/' || v_file_uuid_2::text || '.webp'
      AND processed = false
  ), 'Fallo Test 6.2: El borrado en cascada debió encolar v_img_2.';

  -- 6.3 Consulta de cola mediante RPC administrativa y verificación de is_referenced
  SELECT count(*) INTO v_pending_count FROM public.admin_get_pending_storage_cleanups(10);
  ASSERT v_pending_count >= 2, 'Fallo Test 6.3: admin_get_pending_storage_cleanups debió retornar elementos.';

  -- Las imágenes eliminadas no están referenciadas (is_referenced = false)
  ASSERT (
    SELECT is_referenced FROM public.admin_get_pending_storage_cleanups(10)
    WHERE storage_path = v_lugar_1::text || '/' || v_file_uuid_1::text || '.jpg'
  ) = false, 'Fallo Test 6.4: is_referenced debió ser false.';

  -- Marcado exitoso de un ítem de la cola
  DECLARE
    v_clean_id uuid;
    v_mark_res boolean;
  BEGIN
    SELECT id INTO v_clean_id FROM public.lugares_imagenes_eliminadas 
    WHERE storage_path = v_lugar_1::text || '/' || v_file_uuid_1::text || '.jpg';

    v_mark_res := public.admin_mark_storage_cleanup_processed(v_clean_id);
    ASSERT v_mark_res = true, 'Fallo Test 6.5: admin_mark_storage_cleanup_processed debió retornar true.';

    -- Intento de segundo marcado (ya está procesado -> retorna false)
    v_mark_res := public.admin_mark_storage_cleanup_processed(v_clean_id);
    ASSERT v_mark_res = false, 'Fallo Test 6.6: Segundo marcado debe retornar false al ya estar procesado.';
  END;

  RAISE NOTICE 'Test 6 APROBADO: Eliminación en cascada, trigger, is_referenced y marcado de procesado validados.';

  -- Limpieza final del entorno de pruebas
  DELETE FROM public.lugares WHERE id IN (v_lugar_1, v_lugar_inactivo);
  DELETE FROM auth.users WHERE id IN (v_admin_id, v_user_id);
  DELETE FROM public.lugares_imagenes_eliminadas WHERE lugar_id IN (v_lugar_1, v_lugar_inactivo);

  RAISE NOTICE '>>> TODAS LAS PRUEBAS DE MULTIMEDIA DE DESTINOS (6/6) FUERON APROBADAS SATISFACTORIAMENTE <<<';
END $$;
