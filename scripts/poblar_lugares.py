"""
Pobla la tabla `lugares` de Supabase con los 20 lugares del dataset Chaski
(datos históricos de seed derivados de OSM).

Principios y Reglas:
1. Conserva los 20 destinos y 6 categorías originales sin inventar datos.
2. Identificadores estables y honestos:
   - fuente: 'dataset-osm-chaski'
   - external_id: 'seed:<slug>' (identificadores internos de seed, no inventados como IDs OSM).
3. Clasificación de régimen:
   - LIBRE_ACCESO (9 espacios públicos abiertos: parques, miradores, puente, monumento).
   - HORARIO_REGISTRADO (11 destinos comerciales/culturales sin horarios inventados;
     permanecen pendientes de validación y fuera de los itinerarios automáticos).
4. Idempotencia y recuperación de UUIDs:
   - Recupera UUIDs de categorías existentes por nombre.
   - Recupera UUIDs de lugares existentes por (fuente, external_id) o nombre normalizado.
   - Preserva relaciones lugares_categorias evitando duplicados en reejecuciones.
5. Seguridad de credenciales:
   - No expone ni almacena service_role en el archivo `.env` del proyecto móvil.
   - En modo `--dry-run` solo realiza consultas de lectura (GET) con la clave pública anon.
   - En modo `--apply`, si se requiere eludir RLS en tablas protegidas, admite la clave
     administrativa por parámetro de terminal (--service-key) o variable de entorno de sesión
     (SUPABASE_SERVICE_ROLE_KEY).
   - Genera además el script SQL `scripts/seed_lugares.sql` para ejecución directa en el
     SQL Editor del Dashboard de Supabase como alternativa libre de claves.

Uso:
  python scripts/poblar_lugares.py            # Simulación segura (dry-run, lectura pura)
  python scripts/poblar_lugares.py --dry-run  # Equivalente explícito
  python scripts/poblar_lugares.py --apply    # Aplica cambios en Supabase
  python scripts/poblar_lugares.py --apply --service-key <SERVICE_KEY> # Con clave administrativa
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

# ── 1. Carga de Variables de Entorno y Credenciales ───────────────────────────

def resolver_credenciales(service_key_param: str | None = None):
    url = None
    anon_key = None
    env_service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k == "EXPO_PUBLIC_SUPABASE_URL":
                    url = v
                elif k == "EXPO_PUBLIC_SUPABASE_KEY":
                    anon_key = v

    effective_service_key = service_key_param or env_service_key

    if not url:
        print("ERROR: No se encontró EXPO_PUBLIC_SUPABASE_URL en .env")
        sys.exit(1)

    return url, anon_key, effective_service_key


# ── 2. Dataset Canónico de Destinos ──────────────────────────────────────────

# Tuplas con:
# (nombre, categoria_clave, lat, lon, desc, duracion_min, gasto_min, gasto_max,
#  tipo_disponibilidad, external_id)
# NOTA: external_id utiliza prefijo 'seed:' para reflejar que son claves estables
# del dataset semilla de Chaski y no identificadores numéricos nativos de OSM.
LUGARES_DATASET = [
    # ── Cultura (Cerrados / Requiere Horario Registrado) ──
    (
        "Huaca Pucllana (Museo de Sitio)",
        "culture",
        -12.11107,
        -77.03335,
        "Templo ceremonial preinca de barro (200-700 d.C.) en pleno Miraflores. Icono arqueológico de Lima.",
        60,
        15,
        30,
        "HORARIO_REGISTRADO",
        "seed:huaca-pucllana",
    ),
    (
        "Museo Amano (Textil Precolombino)",
        "culture",
        -12.11406,
        -77.04077,
        "Colección privada de textiles de las culturas Chancay, Paracas y Huari.",
        60,
        10,
        25,
        "HORARIO_REGISTRADO",
        "seed:museo-amano",
    ),
    (
        "Casa Museo Ricardo Palma",
        "culture",
        -12.11842,
        -77.02760,
        "Casa donde vivió el escritor Ricardo Palma, autor de Tradiciones Peruanas.",
        45,
        5,
        15,
        "HORARIO_REGISTRADO",
        "seed:casa-museo-ricardo-palma",
    ),
    (
        "Museo Marina Núñez del Prado",
        "culture",
        -12.10106,
        -77.03400,
        "Museo de la escultora boliviana Marina Núñez del Prado, arte abstracto andino.",
        40,
        0,
        10,
        "HORARIO_REGISTRADO",
        "seed:museo-marina-nunez-del-prado",
    ),
    (
        "Museo de Arte Contemporáneo (MAC)",
        "culture",
        -12.12700,
        -77.03300,
        "Museo de arte contemporáneo peruano con exposiciones temporales.",
        60,
        15,
        30,
        "HORARIO_REGISTRADO",
        "seed:museo-arte-contemporaneo-mac",
    ),
    # ── Miradores (Espacios Públicos Abiertos / Libre Acceso) ──
    (
        "Malecón de Miraflores (Parque del Amor)",
        "viewpoint",
        -12.13300,
        -77.02800,
        "Parque con mosaico del beso y vistas panorámicas al Pacífico. Preferido al atardecer.",
        30,
        0,
        0,
        "LIBRE_ACCESO",
        "seed:malecon-parque-del-amor",
    ),
    (
        "Malecón Paul Harris",
        "viewpoint",
        -12.13908,
        -77.02634,
        "Mirador sobre el acantilado con vista al mar y a las playas de Barranco.",
        25,
        0,
        0,
        "LIBRE_ACCESO",
        "seed:malecon-paul-harris",
    ),
    (
        "Mirador Catalina Recavarren",
        "viewpoint",
        -12.14968,
        -77.02357,
        "Punto de observación de parapentes y vista al océano en la Costa Verde.",
        20,
        0,
        0,
        "LIBRE_ACCESO",
        "seed:mirador-catalina-recavarren",
    ),
    (
        "Mirador Sáenz Peña",
        "viewpoint",
        -12.14343,
        -77.02475,
        "Mirador en el malecón de Barranco con vista a la bahía y al acantilado.",
        20,
        0,
        0,
        "LIBRE_ACCESO",
        "seed:mirador-saenz-pena",
    ),
    # ── Parques (Espacios Públicos Abiertos / Libre Acceso) ──
    (
        "Parque Kennedy",
        "park",
        -12.12000,
        -77.03000,
        "El parque central de Miraflores, con decenas de gatos, cultura viva y comercios aledaños.",
        30,
        0,
        0,
        "LIBRE_ACCESO",
        "seed:parque-kennedy",
    ),
    (
        "Parque de las Mariposas de Barranco",
        "park",
        -12.14087,
        -77.02603,
        "Parque temático con mariposario y senderos de Barranco.",
        25,
        0,
        0,
        "LIBRE_ACCESO",
        "seed:parque-mariposas-barranco",
    ),
    (
        "Parque Mercedes Cabello de Carbonera",
        "park",
        -12.10513,
        -77.02843,
        "Parque residencial en Miraflores con área recreativa y vegetación.",
        25,
        0,
        0,
        "LIBRE_ACCESO",
        "seed:parque-mercedes-cabello",
    ),
    # ── Atracciones ──
    (
        "Puente de los Suspiros",
        "attraction",
        -12.14300,
        -77.02400,
        "Puente de madera de Barranco (1876). Tradición: cruzar sin respirar para pedir un deseo.",
        20,
        0,
        0,
        "LIBRE_ACCESO",
        "seed:puente-de-los-suspiros",
    ),
    (
        "Parapente (Paragliding) Costa Verde",
        "attraction",
        -12.12589,
        -77.03744,
        "Vuelo en parapente sobre la Costa Verde desde el Malecón de Miraflores.",
        45,
        30,
        40,
        "HORARIO_REGISTRADO",
        "seed:parapente-costa-verde",
    ),
    (
        "La Casona Suárez",
        "attraction",
        -12.10834,
        -77.03054,
        "Casona histórica de estilo republicano en Miraflores.",
        20,
        0,
        0,
        "HORARIO_REGISTRADO",
        "seed:la-casona-suarez",
    ),
    # ── Monumentos (Espacios Públicos Abiertos / Libre Acceso) ──
    (
        "Monumento a José de San Martín",
        "monument",
        -12.14328,
        -77.02315,
        "Monumento al libertador José de San Martín, en la bajada a Barranco.",
        15,
        0,
        0,
        "LIBRE_ACCESO",
        "seed:monumento-jose-de-san-martin",
    ),
    # ── Gastronomía (Comerciales / Requiere Horario Registrado) ──
    (
        "Cebichería La Marina",
        "gastronomy",
        -12.12800,
        -77.03600,
        "Cebichería de mariscos frescos con ceviche tradicional limeño.",
        60,
        25,
        60,
        "HORARIO_REGISTRADO",
        "seed:cebicheria-la-marina",
    ),
    (
        "Canta Rana",
        "gastronomy",
        -12.14676,
        -77.02232,
        "Cebichería clásica de Barranco, famosa por su ceviche y ambiente tradicional.",
        60,
        15,
        40,
        "HORARIO_REGISTRADO",
        "seed:canta-rana",
    ),
    (
        "Antigua Bodega Dalmacia",
        "gastronomy",
        -12.13241,
        -77.02659,
        "Bodega-café histórico de Miraflores con ambiente bohemio y pisco.",
        40,
        10,
        30,
        "HORARIO_REGISTRADO",
        "seed:antigua-bodega-dalmacia",
    ),
    (
        "La 73 Paradero Gourmet",
        "gastronomy",
        -12.13970,
        -77.02329,
        "Opción gastronómica contemporánea en Barranco.",
        75,
        40,
        80,
        "HORARIO_REGISTRADO",
        "seed:la-73-paradero-gourmet",
    ),
]

CATEGORIAS = {
    "culture": "Cultura",
    "viewpoint": "Miradores",
    "park": "Parques",
    "attraction": "Atracciones",
    "monument": "Historia",
    "gastronomy": "Gastronomía",
}

FUENTE_DATASET = "dataset-osm-chaski"


# ── 3. Cliente HTTP PostgREST ────────────────────────────────────────────────

class SupabaseClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def get(self, endpoint: str):
        url = f"{self.base_url}/rest/v1/{endpoint}"
        req = urllib.request.Request(url, headers=self.headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8")
            print(f"  [GET ERROR {e.code}] {url} -> {err_msg[:250]}")
            raise

    def post(self, table: str, rows: list, prefer: str = "return=representation"):
        if not rows:
            return []
        url = f"{self.base_url}/rest/v1/{table}"
        hdr = dict(self.headers, Prefer=prefer)
        data = json.dumps(rows).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=hdr, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8")
            print(f"\n  [ERROR AL ESCRIBIR EN '{table}'] Código HTTP: {e.code}")
            print(f"  Respuesta del servidor: {err_msg[:400]}")
            if e.code in (401, 403) or "row-level security" in err_msg.lower():
                print("\n  >>> DIAGNÓSTICO DE SEGURIDAD RLS <<<")
                print("  La clave utilizada no posee permisos de escritura (INSERT) en esta tabla.")
                print("  La clave 'anon' pública de Expo solo tiene permisos de LECTURA (SELECT).")
                print("  Soluciones:")
                print("  1. Proporcione la clave de servicio en la terminal (sin guardarla en .env):")
                print("     python scripts/poblar_lugares.py --apply --service-key <SERVICE_KEY>")
                print("  2. O aplique el archivo 'scripts/seed_lugares.sql' en el SQL Editor de Supabase.")
            raise


# ── 4. Generador de Script SQL de Respaldo ────────────────────────────────────

def generar_script_sql(lugares_plan, cat_map):
    sql_lines = [
        "-- ============================================================================",
        "-- SCRIPT SEED: Población Idempotente de Destinos Iniciales Chaski",
        "-- Archivo: scripts/seed_lugares.sql",
        "-- Ejecutable directamente en el SQL Editor de Supabase (rol postgres).",
        "-- ============================================================================",
        "BEGIN;",
        "",
        "-- 1. Categorías",
    ]

    for icono, nombre in CATEGORIAS.items():
        sql_lines.append(
            f"INSERT INTO public.categorias (id, nombre, icono) "
            f"VALUES (COALESCE((SELECT id FROM public.categorias WHERE lower(trim(nombre)) = lower(trim('{nombre}'))), gen_random_uuid()), '{nombre}', '{icono}') "
            f"ON CONFLICT (nombre) DO UPDATE SET icono = EXCLUDED.icono;"
        )

    sql_lines.append("")
    sql_lines.append("-- 2. Destinos (lugares)")

    for item in LUGARES_DATASET:
        nombre, cat_k, lat, lon, desc, dur, gmin, gmax, tipo_d, ext_id = item
        clean_desc = desc.replace("'", "''")
    sql_lines.append("")
    sql_lines.append("-- 2. Destinos (lugares) con resolución previa de duplicados")

    for item in LUGARES_DATASET:
        nombre, cat_k, lat, lon, desc, dur, gmin, gmax, tipo_d, ext_id = item
        clean_desc = desc.replace("'", "''")
        clean_nom = nombre.replace("'", "''")
        clean_stem = nombre.split('(')[0].strip().replace("'", "''")

        sql_lines.append("DO $$")
        sql_lines.append("DECLARE")
        sql_lines.append("  v_existing_id uuid;")
        sql_lines.append("BEGIN")
        sql_lines.append(
            f"  SELECT id INTO v_existing_id FROM public.lugares "
            f"  WHERE (fuente = '{FUENTE_DATASET}' AND external_id = '{ext_id}') "
            f"     OR lower(trim(nombre)) = lower(trim('{clean_nom}')) "
            f"     OR (lower(trim(nombre)) LIKE lower(trim('{clean_stem}%')) AND abs(latitud - ({lat})) < 0.002 AND abs(longitud - ({lon})) < 0.002) "
            f"  LIMIT 1;"
        )
        sql_lines.append("  IF v_existing_id IS NOT NULL THEN")
        sql_lines.append(
            f"    UPDATE public.lugares SET "
            f"      nombre = '{clean_nom}', "
            f"      descripcion = '{clean_desc}', "
            f"      latitud = {lat}, "
            f"      longitud = {lon}, "
            f"      gasto_min = {gmin}, "
            f"      gasto_max = {gmax}, "
            f"      duracion_sugerida_min = {dur}, "
            f"      estado = true, "
            f"      fuente = '{FUENTE_DATASET}', "
            f"      external_id = '{ext_id}', "
            f"      tipo_disponibilidad = '{tipo_d}' "
            f"    WHERE id = v_existing_id;"
        )
        sql_lines.append("  ELSE")
        sql_lines.append(
            f"    INSERT INTO public.lugares (nombre, descripcion, direccion, latitud, longitud, gasto_min, gasto_max, duracion_sugerida_min, estado, fuente, external_id, tipo_disponibilidad, fecha_actualizacion) "
            f"    VALUES ('{clean_nom}', '{clean_desc}', NULL, {lat}, {lon}, {gmin}, {gmax}, {dur}, true, '{FUENTE_DATASET}', '{ext_id}', '{tipo_d}', '2026-09-09T00:00:00Z');"
        )
        sql_lines.append("  END IF;")
        sql_lines.append("END $$;")

    sql_lines.append("")
    sql_lines.append("-- 3. Relaciones lugares_categorias")
    for item in LUGARES_DATASET:
        nombre, cat_k, *_ = item
        cat_nom = CATEGORIAS[cat_k]
        clean_nom = nombre.replace("'", "''")
        sql_lines.append(
            f"INSERT INTO public.lugares_categorias (lugar_id, categoria_id) "
            f"SELECT l.id, c.id FROM public.lugares l, public.categorias c "
            f"WHERE l.nombre = '{clean_nom}' AND c.nombre = '{cat_nom}' "
            f"ON CONFLICT (lugar_id, categoria_id) DO NOTHING;"
        )

    sql_lines.append("")
    sql_lines.append("COMMIT;")
    sql_content = "\n".join(sql_lines) + "\n"

    os.makedirs("scripts", exist_ok=True)
    with open("scripts/seed_lugares.sql", "w", encoding="utf-8") as f:
        f.write(sql_content)


# ── 5. Lógica Principal de Sincronización e Idempotencia ──────────────────────

def run(dry_run: bool = True, service_key: str | None = None):
    print("=" * 80)
    print(" CHASKI — PREPARACIÓN SEGURA DEL DATASET INICIAL DE DESTINOS")
    print(f" MODO: {'[DRY-RUN / SIMULACIÓN (CERO ESCRITURAS)]' if dry_run else '[APPLY / ESCRITURA REAL]'}")
    print("=" * 80)

    url, anon_key, effective_service_key = resolver_credenciales(service_key)
    
    # Determinar qué llave usar para la conexión
    if dry_run:
        # En dry-run SIEMPRE usamos la clave anónima pública de lectura
        active_key = anon_key
        key_desc = "pública anon (solo lectura)"
    else:
        # En apply usamos service_role si fue provista, o anon con advertencia
        if effective_service_key:
            active_key = effective_service_key
            key_desc = "service_role (administrativa de sesión)"
        else:
            active_key = anon_key
            key_desc = "pública anon (ADVERTENCIA: fallará si RLS bloquea INSERT)"

    client = SupabaseClient(url, active_key)
    print(f"Conectado a: {url}")
    print(f"Llave en uso: {key_desc}")

    # 1. Recuperar Categorías existentes
    print("\n[1/4] Consultando categorias existentes...")
    cats_remotas = client.get("categorias?select=id,nombre")
    cat_map = {c["nombre"]: c["id"] for c in cats_remotas}
    print(f"  Categorías encontradas en BD: {len(cat_map)}")
    for nombre, cid in cat_map.items():
        print(f"    - {nombre}: {cid}")

    cats_faltantes = []
    for icono, nombre in CATEGORIAS.items():
        if nombre not in cat_map:
            cats_faltantes.append({"id": str(uuid.uuid4()), "nombre": nombre, "icono": icono})

    if cats_faltantes:
        print(f"  Categorías faltantes por crear ({len(cats_faltantes)}):")
        for c in cats_faltantes:
            print(f"    + [{c['icono']}] {c['nombre']} (ID asignado: {c['id'][:8]}...)")
        if not dry_run:
            creadas = client.post("categorias", cats_faltantes)
            for c in creadas:
                cat_map[c["nombre"]] = c["id"]
        else:
            for c in cats_faltantes:
                cat_map[c["nombre"]] = c["id"]
    else:
        print("  Todas las categorías canónicas ya existen en la BD.")

    # 2. Recuperar Lugares existentes (por fuente/external_id, nombre exacto o raíz + ubicación)
    print("\n[2/4] Consultando destinos existentes...")
    lugares_remotos = client.get("lugares?select=id,nombre,fuente,external_id,latitud,longitud")
    print(f"  Destinos encontrados en BD: {len(lugares_remotos)}")

    place_id_by_ext = {
        (p["fuente"], p["external_id"]): p["id"]
        for p in lugares_remotos
        if p.get("fuente") and p.get("external_id")
    }
    place_id_by_name = {p["nombre"].strip().lower(): p["id"] for p in lugares_remotos}

    import re
    def get_stem(n: str) -> str:
        return re.sub(r'\(.*?\)', '', n).strip().lower()

    place_id_by_stem = {get_stem(p["nombre"]): p for p in lugares_remotos}

    lugares_to_insert = []
    lugares_plan = []
    resolved_place_ids = {}

    for item in LUGARES_DATASET:
        (nombre, cat_key, lat, lon, desc, dur, gmin, gmax, tipo_disp, ext_id) = item
        norm_name = nombre.strip().lower()
        stem = get_stem(nombre)

        stem_id = None
        matched_by_stem = place_id_by_stem.get(stem)
        if matched_by_stem:
            db_lat = matched_by_stem.get("latitud")
            db_lon = matched_by_stem.get("longitud")
            if db_lat is not None and db_lon is not None:
                if abs(float(db_lat) - lat) < 0.005 and abs(float(db_lon) - lon) < 0.005:
                    stem_id = matched_by_stem["id"]
            else:
                stem_id = matched_by_stem["id"]

        existing_id = place_id_by_ext.get((FUENTE_DATASET, ext_id)) or place_id_by_name.get(norm_name) or stem_id

        if existing_id:
            resolved_id = existing_id
            action = "OMITIR (YA EXISTE)"
        else:
            resolved_id = str(uuid.uuid4())
            action = "INSERTAR"
            row = {
                "id": resolved_id,
                "nombre": nombre,
                "descripcion": desc,
                "direccion": None,
                "latitud": lat,
                "longitud": lon,
                "gasto_min": gmin,
                "gasto_max": gmax,
                "duracion_sugerida_min": dur,
                "estado": True,
                "fuente": FUENTE_DATASET,
                "external_id": ext_id,
                "tipo_disponibilidad": tipo_disp,
                "fecha_actualizacion": "2026-09-09T00:00:00Z",
            }
            lugares_to_insert.append(row)

        resolved_place_ids[nombre] = resolved_id
        lugares_plan.append({
            "nombre": nombre,
            "categoria": CATEGORIAS[cat_key],
            "tipo_disponibilidad": tipo_disp,
            "external_id": ext_id,
            "action": action,
            "id": resolved_id,
        })

    print(f"  Destinos a insertar: {len(lugares_to_insert)}")
    print(f"  Destinos ya existentes (reutilizando UUIDs): {len(lugares_plan) - len(lugares_to_insert)}")

    # 3. Relaciones lugares_categorias (Idempotente)
    print("\n[3/4] Consultando relaciones lugares_categorias existentes...")
    links_remotos = client.get("lugares_categorias?select=lugar_id,categoria_id")
    existing_links = {(lnk["lugar_id"], lnk["categoria_id"]) for lnk in links_remotos}
    print(f"  Relaciones existentes en BD: {len(existing_links)}")

    links_to_insert = []
    for item in LUGARES_DATASET:
        nombre = item[0]
        cat_key = item[1]
        cat_nombre = CATEGORIAS[cat_key]
        lugar_id = resolved_place_ids[nombre]
        cat_id = cat_map[cat_nombre]

        if (lugar_id, cat_id) not in existing_links:
            links_to_insert.append({
                "lugar_id": lugar_id,
                "categoria_id": cat_id,
                "nombre_lugar": nombre,
                "nombre_cat": cat_nombre,
            })

    print(f"  Relaciones a insertar: {len(links_to_insert)}")
    print(f"  Relaciones ya vinculadas: {len(LUGARES_DATASET) - len(links_to_insert)}")

    # Generar script SQL auxiliar de respaldo
    generar_script_sql(lugares_plan, cat_map)
    print("  [OK] Script SQL de respaldo actualizado en: scripts/seed_lugares.sql")

    # 4. Resumen de Elegibilidad para el Motor de Itinerarios
    print("\n" + "=" * 80)
    print(" RESUMEN DE ELEGIBILIDAD PARA EL MOTOR DE ITINERARIOS (plan-engine)")
    print("=" * 80)
    print(f"{'Destino':<38} | {'external_id':<30} | {'Régimen':<18} | {'Engine Status'}")
    print("-" * 105)

    libres_count = 0
    horarios_count = 0
    for lp in lugares_plan:
        if lp["tipo_disponibilidad"] == "LIBRE_ACCESO":
            libres_count += 1
            status = "ELEGIBLE (9)"
        else:
            horarios_count += 1
            status = "PENDIENTE (11)"
        print(f"{lp['nombre'][:37]:<38} | {lp['external_id']:<30} | {lp['tipo_disponibilidad']:<18} | {status}")

    print("-" * 105)
    print(f"Total: {len(lugares_plan)} destinos | {libres_count} LIBRE_ACCESO (Elegibles) | {horarios_count} HORARIO_REGISTRADO (Pendientes)")

    # 5. Ejecución o Notificación de Dry-Run
    print("\n" + "=" * 80)
    if dry_run:
        print(" DIAGNÓSTICO DRY-RUN COMPLETADO CON ÉXITO")
        print(" >>> CERO ESCRITURAS REALIZADAS EN SUPABASE REMOTO <<<")
        print("\n Opciones para aplicar los datos una vez aprobados:")
        print(" 1) Vía PostgREST con clave administrativa temporal:")
        print("    python scripts/poblar_lugares.py --apply --service-key <SERVICE_KEY>")
        print(" 2) Vía SQL en el Dashboard de Supabase:")
        print("    Copiar y ejecutar el contenido de: scripts/seed_lugares.sql")
        print("=" * 80)
    else:
        print(" APLICANDO CAMBIOS EN SUPABASE REMOTO...")
        if lugares_to_insert:
            inserted_places = client.post("lugares", lugares_to_insert)
            print(f"  [OK] Lugares insertados: {len(inserted_places)}")
        if links_to_insert:
            clean_links = [{"lugar_id": l["lugar_id"], "categoria_id": l["categoria_id"]} for l in links_to_insert]
            inserted_links = client.post("lugares_categorias", clean_links)
            print(f"  [OK] Relaciones vinculadas: {len(inserted_links)}")
        print(" SINCRONIZACIÓN EXITOSA EN SUPABASE REMOTO.")
        print("=" * 80)


# ── 6. Entrada Principal ──────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Poblar dataset inicial de lugares en Supabase con verificación e idempotencia."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Simula la sincronización sin escribir en la BD (predeterminado).",
    )
    group.add_argument(
        "--apply",
        action="store_true",
        help="Aplica los cambios reales en Supabase remoto.",
    )
    parser.add_argument(
        "--service-key",
        type=str,
        default=None,
        help="Clave de servicio administrativa temporal para ejecutar --apply eludiendo RLS.",
    )

    args = parser.parse_args()
    is_apply = args.apply

    run(dry_run=not is_apply, service_key=args.service_key)


if __name__ == "__main__":
    main()
