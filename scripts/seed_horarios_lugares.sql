-- ============================================================================
-- CHASKI · Horarios reales de los lugares HORARIO_REGISTRADO
-- ============================================================================
-- Problema que resuelve:
--   El motor de planes descarta todo lugar con tipo_disponibilidad =
--   'HORARIO_REGISTRADO' cuando no hay filas en public.horarios_lugar
--   (ver src/features/plan-engine/viability.ts, función de compatibilidad
--   horaria). Con este seed los 11 lugares pasan de NO_VIABLE a viables,
--   así que el catálogo utilizable sube de 9 a 20 lugares.
--
-- Convenciones (confirmadas en viability.ts):
--   dia_semana: 1 = Lunes ... 7 = Domingo (ISO-8601)
--   CHECK de la tabla: hora_cierre > hora_apertura (no hay rangos nocturnos
--   que crucen medianoche; los turnos nocturnos se cargan como intervalo
--   aparte, p. ej. Huaca Pucllana 18:45-21:00).
--
-- Idempotente: borra los horarios de estos 11 lugares y los vuelve a insertar.
-- No toca ningún otro lugar.
--
-- FUENTES (consultadas 2026-11-08):
--   Huaca Pucllana ......... museos.cultura.pe/museos/museo-de-sitio-pucllana
--                            Diurno: miércoles a lunes 09:00-17:00 (martes cerrado)
--                            Nocturno: miércoles a domingo 18:45-21:00
--   Museo Amano ............ whichmuseum.com (lunes cerrado con cita previa)
--                            Martes a domingo 10:00-17:00
--   MAC Lima ............... maclima.pe/contacto (lunes cerrado)
--                            Martes a domingo 10:00-19:00
--   Casa Museo Ricardo Palma whichmuseum.com/museum/casa-museo-ricardo-palma
--                            Lun-Vie 09:15-12:45 y 14:30-16:25
--                            Sábado 16:00-21:00 / Domingo 16:15-21:00
--   Museo Marina Núñez del Prado  evendo.com + tripadvisor
--                            Lun-Vie 09:00-16:00 / Sábado 09:00-13:00
--   Antigua Bodega Dalmacia  OpenStreetMap opening_hours (Mo-Sa 11:00-21:00)
--   Canta Rana ............. cantarana.pe ("Martes a Sábado 11am-10pm,
--                            Domingo 11am-8pm, Lunes 11am-6pm")
--   La 73 Paradero Gourmet . restaurantela73.com ("Lunes-Sábado 12:00 a 23:00,
--                            Domingo 12:00 a 21:00")
--   Parapente Costa Verde .. parapentelima.pe ("volamos todos los días desde
--                            las 10 am"; hora de cierre no publicada -> se usa
--                            17:00 como cierre conservador por luz solar)
--
--   SIN FUENTE VERIFICABLE (se usa criterio, marcado explícitamente):
--   Cebichería La Marina ... horario típico de cevichería limeña 11:00-17:00.
--                            No se encontró ficha oficial de este local.
--   La Casona Suárez ....... es una casona de EVENTOS privada (no museo con
--                            visitas): se cambia a LIBRE_ACCESO (se aprecia
--                            desde el exterior, costo S/0, 20 min).
-- ============================================================================

-- ── 1. Limpiar solo los horarios de estos 11 lugares ────────────────────────
DELETE FROM public.horarios_lugar h
USING public.lugares l
WHERE h.lugar_id = l.id
  AND l.nombre IN (
    'Huaca Pucllana (Museo de Sitio)',
    'Museo Amano (Textil Precolombino)',
    'Museo de Arte Contemporáneo (MAC)',
    'Casa Museo Ricardo Palma',
    'Museo Marina Núñez del Prado',
    'Antigua Bodega Dalmacia',
    'Canta Rana',
    'La 73 Paradero Gourmet',
    'Parapente (Paragliding) Costa Verde',
    'Cebichería La Marina'
  );

-- ── 2. Cargar horarios reales ───────────────────────────────────────────────
INSERT INTO public.horarios_lugar (lugar_id, dia_semana, hora_apertura, hora_cierre)
SELECT l.id, v.dia, v.apertura::time, v.cierre::time
FROM (VALUES
  -- Huaca Pucllana: turno diurno mié(3) a lun(1) 09:00-17:00
  ('Huaca Pucllana (Museo de Sitio)', 3, '09:00', '17:00'),
  ('Huaca Pucllana (Museo de Sitio)', 4, '09:00', '17:00'),
  ('Huaca Pucllana (Museo de Sitio)', 5, '09:00', '17:00'),
  ('Huaca Pucllana (Museo de Sitio)', 6, '09:00', '17:00'),
  ('Huaca Pucllana (Museo de Sitio)', 7, '09:00', '17:00'),
  ('Huaca Pucllana (Museo de Sitio)', 1, '09:00', '17:00'),
  -- Huaca Pucllana: turno nocturno mié(3) a dom(7) 18:45-21:00
  ('Huaca Pucllana (Museo de Sitio)', 3, '18:45', '21:00'),
  ('Huaca Pucllana (Museo de Sitio)', 4, '18:45', '21:00'),
  ('Huaca Pucllana (Museo de Sitio)', 5, '18:45', '21:00'),
  ('Huaca Pucllana (Museo de Sitio)', 6, '18:45', '21:00'),
  ('Huaca Pucllana (Museo de Sitio)', 7, '18:45', '21:00'),

  -- Museo Amano: martes(2) a domingo(7) 10:00-17:00
  ('Museo Amano (Textil Precolombino)', 2, '10:00', '17:00'),
  ('Museo Amano (Textil Precolombino)', 3, '10:00', '17:00'),
  ('Museo Amano (Textil Precolombino)', 4, '10:00', '17:00'),
  ('Museo Amano (Textil Precolombino)', 5, '10:00', '17:00'),
  ('Museo Amano (Textil Precolombino)', 6, '10:00', '17:00'),
  ('Museo Amano (Textil Precolombino)', 7, '10:00', '17:00'),

  -- MAC Lima: martes(2) a domingo(7) 10:00-19:00
  ('Museo de Arte Contemporáneo (MAC)', 2, '10:00', '19:00'),
  ('Museo de Arte Contemporáneo (MAC)', 3, '10:00', '19:00'),
  ('Museo de Arte Contemporáneo (MAC)', 4, '10:00', '19:00'),
  ('Museo de Arte Contemporáneo (MAC)', 5, '10:00', '19:00'),
  ('Museo de Arte Contemporáneo (MAC)', 6, '10:00', '19:00'),
  ('Museo de Arte Contemporáneo (MAC)', 7, '10:00', '19:00'),

  -- Casa Museo Ricardo Palma: lun(1) a vie(5) dos turnos
  ('Casa Museo Ricardo Palma', 1, '09:15', '12:45'),
  ('Casa Museo Ricardo Palma', 2, '09:15', '12:45'),
  ('Casa Museo Ricardo Palma', 3, '09:15', '12:45'),
  ('Casa Museo Ricardo Palma', 4, '09:15', '12:45'),
  ('Casa Museo Ricardo Palma', 5, '09:15', '12:45'),
  ('Casa Museo Ricardo Palma', 1, '14:30', '16:25'),
  ('Casa Museo Ricardo Palma', 2, '14:30', '16:25'),
  ('Casa Museo Ricardo Palma', 3, '14:30', '16:25'),
  ('Casa Museo Ricardo Palma', 4, '14:30', '16:25'),
  ('Casa Museo Ricardo Palma', 5, '14:30', '16:25'),
  -- Casa Museo Ricardo Palma: fin de semana
  ('Casa Museo Ricardo Palma', 6, '16:00', '21:00'),
  ('Casa Museo Ricardo Palma', 7, '16:15', '21:00'),

  -- Museo Marina Núñez del Prado: lun(1) a vie(5) 09:00-16:00, sáb(6) 09:00-13:00
  ('Museo Marina Núñez del Prado', 1, '09:00', '16:00'),
  ('Museo Marina Núñez del Prado', 2, '09:00', '16:00'),
  ('Museo Marina Núñez del Prado', 3, '09:00', '16:00'),
  ('Museo Marina Núñez del Prado', 4, '09:00', '16:00'),
  ('Museo Marina Núñez del Prado', 5, '09:00', '16:00'),
  ('Museo Marina Núñez del Prado', 6, '09:00', '13:00'),

  -- Antigua Bodega Dalmacia: lun(1) a sáb(6) 11:00-21:00 (domingo cerrado)
  ('Antigua Bodega Dalmacia', 1, '11:00', '21:00'),
  ('Antigua Bodega Dalmacia', 2, '11:00', '21:00'),
  ('Antigua Bodega Dalmacia', 3, '11:00', '21:00'),
  ('Antigua Bodega Dalmacia', 4, '11:00', '21:00'),
  ('Antigua Bodega Dalmacia', 5, '11:00', '21:00'),
  ('Antigua Bodega Dalmacia', 6, '11:00', '21:00'),

  -- Canta Rana: mar(2) a sáb(6) 11:00-22:00, dom(7) 11:00-20:00, lun(1) 11:00-18:00
  ('Canta Rana', 2, '11:00', '22:00'),
  ('Canta Rana', 3, '11:00', '22:00'),
  ('Canta Rana', 4, '11:00', '22:00'),
  ('Canta Rana', 5, '11:00', '22:00'),
  ('Canta Rana', 6, '11:00', '22:00'),
  ('Canta Rana', 7, '11:00', '20:00'),
  ('Canta Rana', 1, '11:00', '18:00'),

  -- La 73 Paradero Gourmet: lun(1) a sáb(6) 12:00-23:00, dom(7) 12:00-21:00
  ('La 73 Paradero Gourmet', 1, '12:00', '23:00'),
  ('La 73 Paradero Gourmet', 2, '12:00', '23:00'),
  ('La 73 Paradero Gourmet', 3, '12:00', '23:00'),
  ('La 73 Paradero Gourmet', 4, '12:00', '23:00'),
  ('La 73 Paradero Gourmet', 5, '12:00', '23:00'),
  ('La 73 Paradero Gourmet', 6, '12:00', '23:00'),
  ('La 73 Paradero Gourmet', 7, '12:00', '21:00'),

  -- Parapente Costa Verde: todos los días 10:00-17:00 (cierre conservador)
  ('Parapente (Paragliding) Costa Verde', 1, '10:00', '17:00'),
  ('Parapente (Paragliding) Costa Verde', 2, '10:00', '17:00'),
  ('Parapente (Paragliding) Costa Verde', 3, '10:00', '17:00'),
  ('Parapente (Paragliding) Costa Verde', 4, '10:00', '17:00'),
  ('Parapente (Paragliding) Costa Verde', 5, '10:00', '17:00'),
  ('Parapente (Paragliding) Costa Verde', 6, '10:00', '17:00'),
  ('Parapente (Paragliding) Costa Verde', 7, '10:00', '17:00'),

  -- Cebichería La Marina: SIN FUENTE OFICIAL -> horario típico de cevichería
  ('Cebichería La Marina', 2, '11:00', '17:00'),
  ('Cebichería La Marina', 3, '11:00', '17:00'),
  ('Cebichería La Marina', 4, '11:00', '17:00'),
  ('Cebichería La Marina', 5, '11:00', '17:00'),
  ('Cebichería La Marina', 6, '11:00', '17:00'),
  ('Cebichería La Marina', 7, '11:00', '17:00')
) AS v(nombre, dia, apertura, cierre)
JOIN public.lugares l ON lower(btrim(l.nombre)) = lower(btrim(v.nombre))
WHERE v.cierre::time > v.apertura::time;

-- ── 3. La Casona Suárez: recinto de eventos, no museo con visitas ───────────
-- Se aprecia desde el exterior (costo S/0, 20 min) -> pasa a LIBRE_ACCESO
UPDATE public.lugares
SET tipo_disponibilidad = 'LIBRE_ACCESO',
    descripcion = 'Casona neobarroca de Miraflores, réplica del Palacio de Gobierno. Recinto privado de eventos: se aprecia desde el exterior.',
    fecha_actualizacion = now()
WHERE lower(btrim(nombre)) = lower('La Casona Suárez');

-- ── 4. Completar dirección de los lugares que la tenían en NULL ─────────────
UPDATE public.lugares SET direccion = 'Calle General Borgoño cdra. 8, Miraflores', fecha_actualizacion = now()
WHERE lower(btrim(nombre)) = lower('Huaca Pucllana (Museo de Sitio)') AND direccion IS NULL;

UPDATE public.lugares SET direccion = 'Calle Retiro 160, Miraflores', fecha_actualizacion = now()
WHERE lower(btrim(nombre)) = lower('Museo Amano (Textil Precolombino)') AND direccion IS NULL;

UPDATE public.lugares SET direccion = 'Av. Grau 1511, Barranco', fecha_actualizacion = now()
WHERE lower(btrim(nombre)) = lower('Museo de Arte Contemporáneo (MAC)') AND direccion IS NULL;

UPDATE public.lugares SET direccion = 'Calle General Suárez 189, Miraflores', fecha_actualizacion = now()
WHERE lower(btrim(nombre)) = lower('Casa Museo Ricardo Palma') AND direccion IS NULL;

UPDATE public.lugares SET direccion = 'Calle Ántero Aspíllaga 300, San Isidro', fecha_actualizacion = now()
WHERE lower(btrim(nombre)) = lower('Museo Marina Núñez del Prado') AND direccion IS NULL;

UPDATE public.lugares SET direccion = 'Jr. Génova 101, Barranco', fecha_actualizacion = now()
WHERE lower(btrim(nombre)) = lower('Canta Rana') AND direccion IS NULL;

UPDATE public.lugares SET direccion = 'Av. El Sol Oeste 175, Barranco', fecha_actualizacion = now()
WHERE lower(btrim(nombre)) = lower('La 73 Paradero Gourmet') AND direccion IS NULL;

UPDATE public.lugares SET direccion = 'Parque Raimondi, Costa Verde, Miraflores', fecha_actualizacion = now()
WHERE lower(btrim(nombre)) = lower('Parapente (Paragliding) Costa Verde') AND direccion IS NULL;

UPDATE public.lugares SET direccion = 'Av. Arequipa 4275, Miraflores', fecha_actualizacion = now()
WHERE lower(btrim(nombre)) = lower('La Casona Suárez') AND direccion IS NULL;

-- ── 5. Verificación ────────────────────────────────────────────────────────
SELECT l.nombre,
       l.tipo_disponibilidad,
       count(h.id) AS intervalos_semana,
       string_agg(DISTINCT h.dia_semana::text, ',' ORDER BY h.dia_semana::text) AS dias
FROM public.lugares l
LEFT JOIN public.horarios_lugar h ON h.lugar_id = l.id
WHERE l.estado = true
GROUP BY l.nombre, l.tipo_disponibilidad
ORDER BY l.tipo_disponibilidad, l.nombre;
