-- ============================================================================
-- CHASKI · ESQUEMA BASE (reconstruido desde el código de la aplicación)
-- Archivo: supabase/migrations/00000000000000_base_schema.sql
--
-- ¿POR QUÉ EXISTE ESTE ARCHIVO?
--   El repositorio solo contenía 6 migraciones, y ninguna crea las tablas base
--   (usuarios, categorias, lugares, horarios_lugar, etiquetas, preferencias_*,
--   solicitudes_plan*). Esas tablas existían únicamente en el proyecto Supabase
--   original, así que el repo NO podía recrear la base de datos desde cero.
--   Este script reconstruye ese esquema leyendo las interfaces y consultas reales
--   de la app (Place, PlaceSchedule, SolicitudPlanRow, UserProfileRecord, etc.).
--
-- ORDEN DE EJECUCIÓN (SQL Editor de Supabase, uno por uno):
--   0) ESTE archivo
--   1) 20261011163000_save_user_preferences_atomic.sql
--   2) 20261013160000_create_avatars_bucket.sql
--   3) 20261014100000_admin_roles_and_management.sql
--   4) 20261014140000_places_multimedia_and_bucket.sql
--   5) 20261014150000_places_idempotency_constraints.sql
--   6) 20261015103000_expediciones_plan.sql
--   7) scripts/seed_lugares.sql
--
-- CARACTERÍSTICAS:
--   · Idempotente: se puede ejecutar varias veces sin duplicar ni fallar.
--   · No borra datos: solo CREATE ... IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.
--   · Compatible con las migraciones posteriores (no invade lo que ellas definen:
--     imágenes de lugares, expediciones y las políticas estrictas de usuarios).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Extensiones requeridas (gen_random_uuid)
-- ────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. USUARIOS — perfil público sincronizado con Supabase Auth
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios (
  id            uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre        text        NOT NULL,
  rol           text        NOT NULL DEFAULT 'USUARIO',
  estado        boolean     NOT NULL DEFAULT true,
  fecha_registro timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_rol_check       CHECK (rol IN ('USUARIO', 'ADMIN')),
  CONSTRAINT usuarios_nombre_len_check CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 60)
);

CREATE INDEX IF NOT EXISTS usuarios_rol_estado_idx ON public.usuarios (rol, estado);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. CATEGORÍAS — intereses culturales del catálogo
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categorias (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text    NOT NULL UNIQUE,
  descripcion text,
  icono       text,
  estado      boolean NOT NULL DEFAULT true
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. ETIQUETAS — clasificación libre del catálogo
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.etiquetas (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. LUGARES — destinos patrimoniales / gastronómicos
--    tipo_disponibilidad es clave para el motor (viability.ts):
--      LIBRE_ACCESO      → elegible sin horarios registrados
--      HORARIO_REGISTRADO→ exige filas en horarios_lugar para el día consultado
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lugares (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                text          NOT NULL,
  descripcion           text,
  direccion             text,
  latitud               double precision NOT NULL,
  longitud              double precision NOT NULL,
  gasto_min             numeric(10,2),
  gasto_max             numeric(10,2),
  duracion_sugerida_min integer,
  estado                boolean       NOT NULL DEFAULT true,
  fuente                text          NOT NULL DEFAULT 'manual',
  external_id           text,
  tipo_disponibilidad   text          NOT NULL DEFAULT 'HORARIO_REGISTRADO',
  fecha_actualizacion   timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT lugares_tipo_disponibilidad_check CHECK (tipo_disponibilidad IN ('LIBRE_ACCESO', 'HORARIO_REGISTRADO')),
  CONSTRAINT lugares_coords_check      CHECK (latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180),
  CONSTRAINT lugares_gasto_min_check    CHECK (gasto_min IS NULL OR gasto_min >= 0),
  CONSTRAINT lugares_gasto_max_check    CHECK (gasto_max IS NULL OR gasto_max >= 0),
  CONSTRAINT lugares_gasto_rango_check  CHECK (gasto_min IS NULL OR gasto_max IS NULL OR gasto_max >= gasto_min),
  CONSTRAINT lugares_duracion_check     CHECK (duracion_sugerida_min IS NULL OR duracion_sugerida_min BETWEEN 5 AND 1440)
);

-- Unicidad de origen (la usa el seed idempotente: fuente + external_id)
CREATE UNIQUE INDEX IF NOT EXISTS lugares_fuente_external_id_key
  ON public.lugares (fuente, external_id)
  WHERE external_id IS NOT NULL;

-- Optimiza getActivePlaces (filtra estado + tipo_disponibilidad)
CREATE INDEX IF NOT EXISTS lugares_estado_tipo_idx
  ON public.lugares (estado, tipo_disponibilidad);

CREATE INDEX IF NOT EXISTS lugares_nombre_idx ON public.lugares (lower(btrim(nombre)));

-- ────────────────────────────────────────────────────────────────────────────
-- 5. HORARIOS DE LUGAR — un registro por día de la semana (ISO: 1 = lunes)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.horarios_lugar (
  id            uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  lugar_id      uuid     NOT NULL REFERENCES public.lugares (id) ON DELETE CASCADE,
  dia_semana    smallint NOT NULL,
  hora_apertura time     NOT NULL,
  hora_cierre   time     NOT NULL,
  CONSTRAINT horarios_dia_semana_check CHECK (dia_semana BETWEEN 1 AND 7),
  CONSTRAINT horarios_rango_check      CHECK (hora_cierre > hora_apertura)
);

CREATE INDEX IF NOT EXISTS horarios_lugar_lugar_idx ON public.horarios_lugar (lugar_id, dia_semana);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. RELACIONES DEL CATÁLOGO
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lugares_categorias (
  lugar_id     uuid NOT NULL REFERENCES public.lugares (id)    ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES public.categorias (id) ON DELETE CASCADE,
  PRIMARY KEY (lugar_id, categoria_id)
);

CREATE INDEX IF NOT EXISTS lugares_categorias_categoria_idx
  ON public.lugares_categorias (categoria_id);

CREATE TABLE IF NOT EXISTS public.lugares_etiquetas (
  lugar_id   uuid NOT NULL REFERENCES public.lugares (id)   ON DELETE CASCADE,
  etiqueta_id uuid NOT NULL REFERENCES public.etiquetas (id) ON DELETE CASCADE,
  PRIMARY KEY (lugar_id, etiqueta_id)
);

CREATE INDEX IF NOT EXISTS lugares_etiquetas_etiqueta_idx
  ON public.lugares_etiquetas (etiqueta_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. PREFERENCIAS DEL USUARIO
--    (las escribe la función save_user_preferences_atomic de la migración 1)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.preferencias_usuario (
  usuario_id         uuid PRIMARY KEY REFERENCES public.usuarios (id) ON DELETE CASCADE,
  movilidad_preferida text,
  gasto_min          numeric(10,2),
  gasto_max          numeric(10,2),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preferencias_gasto_check CHECK (gasto_min IS NULL OR gasto_min >= 0),
  CONSTRAINT preferencias_gasto_max_check CHECK (gasto_max IS NULL OR gasto_max >= 0)
);

CREATE TABLE IF NOT EXISTS public.preferencias_usuario_categorias (
  usuario_id   uuid NOT NULL REFERENCES public.usuarios (id)   ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES public.categorias (id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, categoria_id)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. SOLICITUDES DE PLAN — lo que el usuario pide en el wizard
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solicitudes_plan (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          uuid NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  fecha_hora_inicio   timestamptz NOT NULL,
  fecha_hora_fin      timestamptz NOT NULL,
  inicio_latitud      double precision NOT NULL,
  inicio_longitud     double precision NOT NULL,
  inicio_descripcion  text,
  tipo_punto_final    text NOT NULL DEFAULT 'REGRESAR_INICIO',
  final_latitud       double precision,
  final_longitud      double precision,
  final_descripcion   text,
  gasto_min           numeric(10,2),
  gasto_max           numeric(10,2),
  movilidad           text NOT NULL,
  fecha_creacion      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT solicitudes_punto_final_check CHECK (tipo_punto_final IN ('REGRESAR_INICIO', 'ULTIMA_PARADA', 'OTRA_UBICACION')),
  CONSTRAINT solicitudes_movilidad_check   CHECK (movilidad IN ('CAMINANDO', 'TRANSPORTE_PUBLICO', 'AUTO')),
  CONSTRAINT solicitudes_fechas_check      CHECK (fecha_hora_fin > fecha_hora_inicio),
  CONSTRAINT solicitudes_coords_check      CHECK (inicio_latitud BETWEEN -90 AND 90 AND inicio_longitud BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS solicitudes_plan_usuario_idx
  ON public.solicitudes_plan (usuario_id, fecha_creacion DESC);

CREATE TABLE IF NOT EXISTS public.solicitudes_plan_categorias (
  solicitud_id uuid NOT NULL REFERENCES public.solicitudes_plan (id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES public.categorias (id)       ON DELETE CASCADE,
  PRIMARY KEY (solicitud_id, categoria_id)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. SEGURIDAD A NIVEL DE FILA (RLS)
--    Catálogo: lectura pública (anon + authenticated).
--    Datos del usuario: cada quien ve/edita solo lo suyo (auth.uid()).
--    Escrituras del catálogo: nadie desde el cliente (solo service_role/admin).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.usuarios                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etiquetas                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lugares                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_lugar                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lugares_categorias              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lugares_etiquetas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferencias_usuario            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferencias_usuario_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_plan                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_plan_categorias     ENABLE ROW LEVEL SECURITY;

-- 9.1 Catálogo: lectura para cualquiera (la app lo consume incluso antes del login)
DROP POLICY IF EXISTS "catalogo_categorias_lectura" ON public.categorias;
CREATE POLICY "catalogo_categorias_lectura" ON public.categorias
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "catalogo_etiquetas_lectura" ON public.etiquetas;
CREATE POLICY "catalogo_etiquetas_lectura" ON public.etiquetas
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "catalogo_lugares_lectura" ON public.lugares;
CREATE POLICY "catalogo_lugares_lectura" ON public.lugares
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "catalogo_horarios_lectura" ON public.horarios_lugar;
CREATE POLICY "catalogo_horarios_lectura" ON public.horarios_lugar
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "catalogo_lugares_categorias_lectura" ON public.lugares_categorias;
CREATE POLICY "catalogo_lugares_categorias_lectura" ON public.lugares_categorias
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "catalogo_lugares_etiquetas_lectura" ON public.lugares_etiquetas;
CREATE POLICY "catalogo_lugares_etiquetas_lectura" ON public.lugares_etiquetas
  FOR SELECT TO anon, authenticated USING (true);

-- 9.2 Usuarios: cada quien lee y edita su propio perfil.
--     (La migración de administración añade después las políticas estrictas y RPCs.)
DROP POLICY IF EXISTS "usuarios_lectura_propia" ON public.usuarios;
CREATE POLICY "usuarios_lectura_propia" ON public.usuarios
  FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "usuarios_edicion_propia" ON public.usuarios;
CREATE POLICY "usuarios_edicion_propia" ON public.usuarios
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 9.3 Preferencias: dueño total
DROP POLICY IF EXISTS "preferencias_propias_todo" ON public.preferencias_usuario;
CREATE POLICY "preferencias_propias_todo" ON public.preferencias_usuario
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS "preferencias_categorias_propias_todo" ON public.preferencias_usuario_categorias;
CREATE POLICY "preferencias_categorias_propias_todo" ON public.preferencias_usuario_categorias
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- 9.4 Solicitudes de plan: dueño total
DROP POLICY IF EXISTS "solicitudes_propias_todo" ON public.solicitudes_plan;
CREATE POLICY "solicitudes_propias_todo" ON public.solicitudes_plan
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS "solicitudes_categorias_propias_todo" ON public.solicitudes_plan_categorias;
CREATE POLICY "solicitudes_categorias_propias_todo" ON public.solicitudes_plan_categorias
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solicitudes_plan s
      WHERE s.id = solicitud_id AND s.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.solicitudes_plan s
      WHERE s.id = solicitud_id AND s.usuario_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 10. GRANTS explícitos (funcionan aunque "Automatically expose new tables" esté off)
-- ────────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.categorias, public.etiquetas, public.lugares,
                public.horarios_lugar, public.lugares_categorias,
                public.lugares_etiquetas
  TO anon, authenticated;

GRANT SELECT, UPDATE ON public.usuarios TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.preferencias_usuario,
                                       public.preferencias_usuario_categorias,
                                       public.solicitudes_plan,
                                       public.solicitudes_plan_categorias
  TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 11. VERIFICACIÓN (debe devolver 11 tablas base)
-- ────────────────────────────────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'usuarios','categorias','etiquetas','lugares','horarios_lugar',
    'lugares_categorias','lugares_etiquetas','preferencias_usuario',
    'preferencias_usuario_categorias','solicitudes_plan',
    'solicitudes_plan_categorias'
  )
ORDER BY table_name;
