-- ============================================================================
-- SCRIPT DE VALIDACIÓN SQL: admin_get_reports (RF20 / CU09)
-- Archivo: scripts/test_admin_reports.sql
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_admin_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_sol_id uuid := gen_random_uuid();
  v_res jsonb;
BEGIN
  -- Insertar usuarios en auth.users; el trigger on_auth_user_created crea la fila en public.usuarios
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES
    (v_admin_id, 'admin_test@chaski.pe', '{"nombre": "Admin Test"}'::jsonb),
    (v_user_id, 'user_test@chaski.pe', '{"nombre": "User Test"}'::jsonb);

  -- Asignar roles explícitos
  UPDATE public.usuarios SET rol = 'ADMIN', estado = true WHERE id = v_admin_id;
  UPDATE public.usuarios SET rol = 'USUARIO', estado = true WHERE id = v_user_id;

  -- 1. Prueba de seguridad: usuario no admin debe fallar con 42501
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  BEGIN
    PERFORM public.admin_get_reports('30d');
    RAISE EXCEPTION 'Fallo: Usuario no admin no fue bloqueado';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      RAISE NOTICE 'Test 1 (Seguridad - No admin bloqueado 42501): OK';
  END;

  -- 2. Establecer sesión como ADMIN
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);

  -- 3. Prueba de período por defecto (30d)
  v_res := public.admin_get_reports('30d');
  ASSERT v_res ? 'rango', 'Falta clave rango';
  ASSERT v_res ? 'kpis', 'Falta clave kpis';
  ASSERT v_res ? 'categorias_ranking', 'Falta categorias_ranking';
  ASSERT v_res ? 'destinos_incluidos_ranking', 'Falta destinos_incluidos_ranking';
  ASSERT v_res ? 'destinos_visitados_ranking', 'Falta destinos_visitados_ranking';
  ASSERT v_res ? 'evolucion', 'Falta evolucion';
  ASSERT (v_res->'rango'->>'periodo') = '30d', 'Periodo debe ser 30d';
  ASSERT (v_res->'rango'->>'agrupacion') = 'dia', 'Agrupacion debe ser dia para 30d';
  RAISE NOTICE 'Test 2 (Periodo 30d): OK';

  -- 4. Prueba de período todo (agrupación mes si supera 90 días)
  v_res := public.admin_get_reports('todo');
  ASSERT v_res ? 'rango', 'Falta clave rango en todo';
  ASSERT (v_res->'rango'->>'periodo') = 'todo', 'Periodo debe ser todo';
  RAISE NOTICE 'Test 3 (Periodo todo): OK';

  -- 5. Prueba de período personalizado válido
  v_res := public.admin_get_reports('personalizado', '2026-10-01T00:00:00Z', '2026-10-15T00:00:00Z');
  ASSERT (v_res->'rango'->>'periodo') = 'personalizado', 'Periodo debe ser personalizado';
  ASSERT (v_res->'rango'->>'agrupacion') = 'dia', 'Agrupacion para 15 dias debe ser dia';
  RAISE NOTICE 'Test 4 (Personalizado 15 dias): OK';

  -- 6. Prueba de rango personalizado amplio (> 90 días debe agrupar por mes)
  v_res := public.admin_get_reports('personalizado', '2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z');
  ASSERT (v_res->'rango'->>'agrupacion') = 'mes', 'Agrupacion para >90 dias debe ser mes';
  RAISE NOTICE 'Test 5 (Personalizado >90 dias agrupa mes): OK';

  -- 7. Prueba de manejo de error ante fechas invertidas (p_desde > p_hasta)
  BEGIN
    PERFORM public.admin_get_reports('personalizado', '2026-11-20T00:00:00Z', '2026-11-10T00:00:00Z');
    RAISE EXCEPTION 'Fallo: Debio lanzar PARAM_INVALID por fechas invertidas';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      RAISE NOTICE 'Test 6 (Fechas invertidas lanza 22023): OK';
  END;

  -- 8. Prueba de manejo de error ante período inválido
  BEGIN
    PERFORM public.admin_get_reports('invalido');
    RAISE EXCEPTION 'Fallo: Debio lanzar PARAM_INVALID por periodo invalido';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      RAISE NOTICE 'Test 7 (Periodo invalido lanza 22023): OK';
  END;

  -- 9. Prueba de manejo de error ante fechas nulas en personalizado
  BEGIN
    PERFORM public.admin_get_reports('personalizado', NULL, NULL);
    RAISE EXCEPTION 'Fallo: Debio lanzar PARAM_INVALID por fechas nulas en personalizado';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      RAISE NOTICE 'Test 8 (Fechas nulas en personalizado lanza 22023): OK';
  END;

  -- 10. Prueba de tolerancia a snapshots atípicos o corruptos
  INSERT INTO public.solicitudes_plan (
    id, usuario_id, fecha_hora_inicio, fecha_hora_fin,
    inicio_latitud, inicio_longitud, movilidad
  ) VALUES (
    v_sol_id, v_admin_id, now(), now() + interval '2 hours',
    -12.0464, -77.0428, 'CAMINANDO'
  );

  INSERT INTO public.expediciones_plan (
    solicitud_id, usuario_id, estado_expedicion, completado_en, plan_snapshot
  ) VALUES (
    v_sol_id, v_admin_id, 'COMPLETADA', now(), '{"paradas": "no-es-un-array"}'::jsonb
  );

  v_res := public.admin_get_reports('7d');
  ASSERT v_res IS NOT NULL, 'Debe procesar sin fallar con snapshot atípico';
  RAISE NOTICE 'Test 9 (Tolerancia a snapshot atípico): OK';
END $$;

ROLLBACK;
