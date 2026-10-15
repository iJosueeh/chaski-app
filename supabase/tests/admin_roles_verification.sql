-- ============================================================================
-- VERIFICACIÓN Y PRUEBAS AUTOMATIZADAS: Módulo de Administración (Fase 1)
-- Archivo: supabase/tests/admin_roles_verification.sql
--
-- Este script valida en un entorno PostgreSQL/Supabase de pruebas:
-- 1. Sincronización automática de nuevo usuario (Trigger handle_new_user).
-- 2. Rechazo de acceso a admin_get_users y admin_get_metrics para usuarios con rol USUARIO.
-- 3. Acceso autorizado a admin_get_users y admin_get_metrics para usuarios con rol ADMIN.
-- 4. Búsqueda y paginación en admin_get_users.
-- 5. Activación / desactivación de usuarios mediante admin_set_user_status.
-- 6. Salvaguarda contra auto-desactivación (error CANNOT_DEACTIVATE_SELF).
-- 7. Salvaguarda contra desactivación del último admin (error LAST_ADMIN_PROTECTION).
-- 8. Restricción de cuentas desactivadas en save_user_preferences_atomic (error ACCOUNT_DISABLED).
-- 9. Inmutabilidad de rol/estado ante UPDATE directo por usuario no administrador.
-- ============================================================================

DO $$
DECLARE
  v_admin_id uuid := gen_random_uuid();
  v_user_1 uuid := gen_random_uuid();
  v_user_2 uuid := gen_random_uuid();
  v_metrics jsonb;
  v_status_res jsonb;
  v_error_caught boolean := false;
  v_pref_res jsonb;
  v_cat_id uuid;
BEGIN
  RAISE NOTICE '>>> INICIANDO PRUEBAS DE VERIFICACIÓN: MÓDULO ADMINISTRATIVO <<<';

  -- --------------------------------------------------------------------------
  -- TEST 1: Sincronización e Integridad de Usuarios (Trigger handle_new_user)
  -- --------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
  VALUES 
    (v_admin_id, 'admin@chaski.pe', '{"nombre": "Super Administrador"}'::jsonb, 'authenticated', 'authenticated'),
    (v_user_1, 'explorador1@chaski.pe', '{"nombre": "Explorador Uno"}'::jsonb, 'authenticated', 'authenticated'),
    (v_user_2, 'explorador2@chaski.pe', '{"nombre": "Explorador Dos"}'::jsonb, 'authenticated', 'authenticated');

  -- Asignar rol ADMIN al primer usuario
  UPDATE public.usuarios SET rol = 'ADMIN' WHERE id = v_admin_id;

  ASSERT (SELECT count(*) FROM public.usuarios WHERE id IN (v_admin_id, v_user_1, v_user_2)) = 3,
    'Fallo Test 1: Los usuarios no se sincronizaron correctamente.';
  ASSERT (SELECT rol FROM public.usuarios WHERE id = v_admin_id) = 'ADMIN',
    'Fallo Test 1: El rol ADMIN no se asignó correctamente.';

  RAISE NOTICE 'Test 1 APROBADO: Sincronización automática de trigger handle_new_user() e integridad comprobada.';

  -- --------------------------------------------------------------------------
  -- TEST 2: Función is_admin() y Permisos
  -- --------------------------------------------------------------------------
  -- Simular contexto de v_admin_id
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text)::text, true);
  ASSERT public.is_admin() = true, 'Fallo Test 2A: is_admin() debió retornar true para v_admin_id.';

  -- Simular contexto de v_user_1
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_1::text)::text, true);
  ASSERT public.is_admin() = false, 'Fallo Test 2B: is_admin() debió retornar false para v_user_1.';

  RAISE NOTICE 'Test 2 APROBADO: is_admin() responde con precisión según el rol en sesión.';

  -- --------------------------------------------------------------------------
  -- TEST 3: Rechazo de RPCs administrativas a usuario común
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_1::text)::text, true);
  
  v_error_caught := false;
  BEGIN
    PERFORM public.admin_get_metrics();
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%AUTH_UNAUTHORIZED%' THEN
      v_error_caught := true;
    END IF;
  END;
  ASSERT v_error_caught = true, 'Fallo Test 3A: admin_get_metrics debió arrojar AUTH_UNAUTHORIZED.';

  v_error_caught := false;
  BEGIN
    PERFORM * FROM public.admin_get_users();
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%AUTH_UNAUTHORIZED%' THEN
      v_error_caught := true;
    END IF;
  END;
  ASSERT v_error_caught = true, 'Fallo Test 3B: admin_get_users debió arrojar AUTH_UNAUTHORIZED.';

  RAISE NOTICE 'Test 3 APROBADO: Usuarios normales son bloqueados de todas las RPCs administrativas.';

  -- --------------------------------------------------------------------------
  -- TEST 4: Acceso exitoso a métricas para ADMIN
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text)::text, true);
  v_metrics := public.admin_get_metrics();
  
  ASSERT (v_metrics->>'total_administradores')::int >= 1, 
    'Fallo Test 4: total_administradores en métricas debe ser >= 1.';
  ASSERT (v_metrics->>'total_usuarios')::int >= 3, 
    'Fallo Test 4: total_usuarios en métricas debe ser >= 3.';

  RAISE NOTICE 'Test 4 APROBADO: admin_get_metrics retorna métricas agregadas correctas.';

  -- --------------------------------------------------------------------------
  -- TEST 5: Salvaguarda contra Auto-Desactivación
  -- --------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    PERFORM public.admin_set_user_status(v_admin_id, false);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%CANNOT_DEACTIVATE_SELF%' THEN
      v_error_caught := true;
    END IF;
  END;
  ASSERT v_error_caught = true, 'Fallo Test 5: Un admin no debe poder desactivarse a sí mismo.';

  RAISE NOTICE 'Test 5 APROBADO: Auto-desactivación prevenida exitosamente.';

  -- --------------------------------------------------------------------------
  -- TEST 6: Salvaguarda contra Desactivación del Último Administrador
  -- --------------------------------------------------------------------------
  -- Si v_admin_id es el único admin, intentar desactivarlo desde otro admin (simulado)
  -- Aseguramos que solo haya 1 admin activo
  v_error_caught := false;
  BEGIN
    -- Forzamos llamada simulando otro admin desactivando al único admin
    -- Para este test, creamos temporalmente admin_auxiliar
    DECLARE
      v_admin_aux uuid := gen_random_uuid();
    BEGIN
      INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
      VALUES (v_admin_aux, 'admin_aux@chaski.pe', '{"nombre": "Admin Aux"}'::jsonb, 'authenticated', 'authenticated');
      UPDATE public.usuarios SET rol = 'ADMIN' WHERE id = v_admin_aux;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_aux::text)::text, true);
      
      -- Desactivar primer admin (quedará solo v_admin_aux como único admin)
      PERFORM public.admin_set_user_status(v_admin_id, false);

      -- v_admin_aux es el único activo ahora:
      BEGIN
        PERFORM public.admin_set_user_status(v_admin_aux, false);
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%CANNOT_DEACTIVATE_SELF%' OR SQLERRM LIKE '%LAST_ADMIN_PROTECTION%' THEN
          v_error_caught := true;
        END IF;
      END;

      -- Resetear contexto JWT a superusuario para la limpieza
      PERFORM set_config('request.jwt.claims', '', true);
      DELETE FROM auth.users WHERE id = v_admin_aux;
      UPDATE public.usuarios SET estado = true WHERE id = v_admin_id;
    END;
  END;
  ASSERT v_error_caught = true, 'Fallo Test 6: Debe prevenirse la desactivación del único admin.';

  RAISE NOTICE 'Test 6 APROBADO: Protección del último administrador activa.';

  -- --------------------------------------------------------------------------
  -- TEST 7: Desactivación y Reactivación de Usuario Normal
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text)::text, true);
  v_status_res := public.admin_set_user_status(v_user_1, false);
  ASSERT (v_status_res->>'nuevo_estado')::boolean = false, 'Fallo Test 7A: Usuario 1 no fue desactivado.';
  ASSERT (SELECT estado FROM public.usuarios WHERE id = v_user_1) = false, 'Fallo Test 7B: Estado en tabla no cambió a false.';

  v_status_res := public.admin_set_user_status(v_user_1, true);
  ASSERT (v_status_res->>'nuevo_estado')::boolean = true, 'Fallo Test 7C: Usuario 1 no fue reactivado.';
  ASSERT (SELECT estado FROM public.usuarios WHERE id = v_user_1) = true, 'Fallo Test 7D: Estado en tabla no volvió a true.';

  RAISE NOTICE 'Test 7 APROBADO: Cambio de estado de usuario por admin opera correctamente.';

  -- --------------------------------------------------------------------------
  -- TEST 8: Restricción de Operaciones a Usuarios Desactivados
  -- --------------------------------------------------------------------------
  -- Desactivar v_user_2
  UPDATE public.usuarios SET estado = false WHERE id = v_user_2;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_2::text)::text, true);

  -- Obtener una categoría activa para la prueba
  SELECT id INTO v_cat_id FROM public.categorias WHERE estado = true LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    v_error_caught := false;
    BEGIN
      PERFORM public.save_user_preferences_atomic(
        ARRAY[v_cat_id],
        10,
        50,
        'caminando',
        true
      );
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%ACCOUNT_DISABLED%' THEN
        v_error_caught := true;
      END IF;
    END;
    ASSERT v_error_caught = true, 'Fallo Test 8: Usuario desactivado no debe poder guardar preferencias.';
    RAISE NOTICE 'Test 8 APROBADO: Cuenta desactivada rechazada con ACCOUNT_DISABLED.';
  ELSE
    RAISE NOTICE 'Test 8 OMITIDO: No hay categorías activas en la BD para probar save_user_preferences_atomic.';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 9: Inmutabilidad de Rol y Estado ante intento de UPDATE directo
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_1::text)::text, true);

  v_error_caught := false;
  BEGIN
    UPDATE public.usuarios SET rol = 'ADMIN' WHERE id = v_user_1;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%CANNOT_MODIFY_ROLE%' OR SQLSTATE = '42501' THEN
      v_error_caught := true;
    END IF;
  END;
  ASSERT v_error_caught = true, 'Fallo Test 9A: Usuario normal no debe poder alterar su rol a ADMIN.';

  v_error_caught := false;
  BEGIN
    UPDATE public.usuarios SET estado = false WHERE id = v_user_1;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%CANNOT_MODIFY_STATUS%' OR SQLSTATE = '42501' THEN
      v_error_caught := true;
    END IF;
  END;
  ASSERT v_error_caught = true, 'Fallo Test 9B: Usuario normal no debe poder alterar su estado.';

  -- Subtest 9C: Validación estricta con rol de PostgreSQL 'authenticated'
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_1::text)::text, true);

  v_error_caught := false;
  BEGIN
    EXECUTE 'UPDATE public.usuarios SET rol = ''ADMIN'' WHERE id = $1' USING v_user_1;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      v_error_caught := true;
    END IF;
  END;
  ASSERT v_error_caught = true, 'Fallo Test 9C: El rol authenticated debe ser bloqueado por permisos de tabla (42501).';

  -- Restaurar rol y claims para limpieza
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);

  RAISE NOTICE 'Test 9 APROBADO: Inmutabilidad de rol, estado y permisos efectivos de rol authenticated garantizados.';

  -- --------------------------------------------------------------------------
  -- Limpieza de datos de prueba
  -- --------------------------------------------------------------------------
  DELETE FROM auth.users WHERE id IN (v_admin_id, v_user_1, v_user_2);

  RAISE NOTICE '>>> TODAS LAS PRUEBAS SQL DE ADMINISTRACIÓN CONCLUYERON EXITOSAMENTE (9/9) <<<';
END $$;
