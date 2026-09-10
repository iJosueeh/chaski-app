"""
Pobla la tabla `lugares` de Supabase con los 20 lugares del dataset Chaski
(proyecto anterior, chaski/src/data/lugares.ts — datos OSM reales).

- Crea categorias faltantes y vincula via `lugares_categorias`.
- Idempotente: si un lugar ya existe (por nombre), lo omite.
- Costos estimados por categoria (los dataset OSM no traen precios):
    culture   -> S/10-30   (museos con entrada)
    viewpoint -> S/0-0     (publico)
    park      -> S/0-0     (publico)
    attraction-> S/0-40    (varia: parapente ~S/40)
    monument  -> S/0-0     (publico)
    gastronomy-> S/25-60   (comer)
- duracion_sugerida_min: culture 60, viewpoint 30, park 30, attraction 45,
  monument 15, gastronomy 60.

Uso: python poblar_lugares.py  (requiere .env con EXPO_PUBLIC_SUPABASE_*)
"""
import json
import urllib.request
import urllib.error
import uuid

URL = KEY = None
for line in open(".env", encoding="utf-8"):
    if line.startswith("EXPO_PUBLIC_SUPABASE_URL"):
        URL = line.split("=", 1)[1].strip()
    if line.startswith("EXPO_PUBLIC_SUPABASE_KEY"):
        KEY = line.split("=", 1)[1].strip()
assert URL and KEY, "faltan credenciales en .env"

HDR = {"apikey": KEY, "Authorization": f"Bearer {KEY}",
       "Content-Type": "application/json", "Prefer": "return=representation"}

# ── Dataset (copiado literal de chaski/src/data/lugares.ts) ──────────────
LUGARES = [
    # (nombre, categoria, lat, lon, desc, duracion, gasto_min, gasto_max)
    ("Huaca Pucllana (Museo de Sitio)", "culture", -12.11107, -77.03335, "Templo ceremonial preinca de barro (200-700 d.C.) en pleno Miraflores. Icono arqueológico de Lima.", 60, 15, 30),
    ("Museo Amano (Textil Precolombino)", "culture", -12.11406, -77.04077, "Colección privada de textiles de las culturas Chancay, Paracas y Huari.", 60, 10, 25),
    ("Casa Museo Ricardo Palma", "culture", -12.11842, -77.02760, "Casa donde vivió el escritor Ricardo Palma, autor de Tradiciones Peruanas.", 45, 5, 15),
    ("Museo Marina Núñez del Prado", "culture", -12.10106, -77.03400, "Museo de la escultora boliviana Marina Núñez del Prado, arte abstracto andino.", 40, 0, 10),
    ("Museo de Arte Contemporáneo (MAC)", "culture", -12.12700, -77.03300, "Museo de arte contemporáneo peruano con exposiciones temporales.", 60, 15, 30),
    ("Malecón de Miraflores (Parque del Amor)", "viewpoint", -12.13300, -77.02800, "Parque con mosaico del beso y vistas panorámicas al Pacífico. Preferido al atardecer.", 30, 0, 0),
    ("Malecón Paul Harris", "viewpoint", -12.13908, -77.02634, "Mirador sobre el acantilado con vista al mar y a las playas de Barranco.", 25, 0, 0),
    ("Mirador Catalina Recavarren", "viewpoint", -12.14968, -77.02357, "Punto de observación de parapentes y vista al océano en la Costa Verde.", 20, 0, 0),
    ("Mirador Sáenz Peña", "viewpoint", -12.14343, -77.02475, "Mirador en el malecón de Barranco con vista a la bahía y al acantilado.", 20, 0, 0),
    ("Parque Kennedy", "park", -12.12000, -77.03000, "El parque central de Miraflores, con decenas de gatos, cultura viva y comercios aledaños.", 30, 0, 0),
    ("Parque de las Mariposas de Barranco", "park", -12.14087, -77.02603, "Parque temático con mariposario y senderos de Barranco.", 25, 0, 0),
    ("Parque Mercedes Cabello de Carbonera", "park", -12.10513, -77.02843, "Parque residencial en Miraflores con área recreativa y vegetación.", 25, 0, 0),
    ("Puente de los Suspiros", "attraction", -12.14300, -77.02400, "Puente de madera de Barranco (1876). Tradición: cruzar sin respirar para pedir un deseo.", 20, 0, 0),
    ("Parapente (Paragliding) Costa Verde", "attraction", -12.12589, -77.03744, "Vuelo en parapente sobre la Costa Verde desde el Malecón de Miraflores.", 45, 30, 40),
    ("Monumento a José de San Martín", "monument", -12.14328, -77.02315, "Monumento al libertador José de San Martín, en la bajada a Barranco.", 15, 0, 0),
    ("La Casona Suárez", "attraction", -12.10834, -77.03054, "Casona histórica de estilo republicano en Miraflores.", 20, 0, 0),
    ("Cebichería La Marina", "gastronomy", -12.12800, -77.03600, "Cebichería de mariscos frescos con ceviche tradicional limeño.", 60, 25, 60),
    ("Canta Rana", "gastronomy", -12.14676, -77.02232, "Cebichería clásica de Barranco, famosa por su ceviche y ambiente tradicional.", 60, 15, 40),
    ("Antigua Bodega Dalmacia", "gastronomy", -12.13241, -77.02659, "Bodega-café histórico de Miraflores con ambiente bohemio y pisco.", 40, 10, 30),
    ("La 73 Paradero Gourmet", "gastronomy", -12.13970, -77.02329, "Opción gastronómica contemporánea en Barranco.", 75, 40, 80),
]

CATEGORIAS = {  # nombre clave -> etiqueta en la tabla
    "culture": "Cultura",
    "viewpoint": "Miradores",
    "park": "Parques",
    "attraction": "Atracciones",
    "monument": "Historia",
    "gastronomy": "Gastronomía",
}


def get(url, params=""):
    req = urllib.request.Request(f"{url}/rest/v1/{params}", headers=HDR)
    return json.load(urllib.request.urlopen(req, timeout=20))


def post(url, table, rows, prefer="return=representation"):
    h = dict(HDR, **{"Prefer": prefer})
    req = urllib.request.Request(f"{url}/rest/v1/{table}",
                                 data=json.dumps(rows).encode(), headers=h, method="POST")
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        print("  ERROR", e.code, e.read().decode()[:300])
        return []


def main():
    # 1. Categorias existentes
    cats = get(URL, "categorias?select=id,nombre")
    cat_map = {c["nombre"]: c["id"] for c in cats}
    # crear faltantes
    faltantes = [{"nombre": v, "icono": k} for k, v in CATEGORIAS.items() if v not in cat_map]
    if faltantes:
        creadas = post(URL, "categorias", faltantes)
        for c in creadas:
            cat_map[c["nombre"]] = c["id"]
    print("categorias:", {k: (v[:8]) for k, v in cat_map.items()})

    # 2. Lugares existentes (por nombre)
    existentes = {p["nombre"] for p in get(URL, "lugares?select=nombre")}
    print(f"lugares ya presentes: {len(existentes)}")

    nuevos, vinculos = [], []
    for nombre, cat, lat, lon, desc, dur, gmin, gmax in LUGARES:
        if nombre in existentes:
            continue
        row = {
            "id": str(uuid.uuid4()),
            "nombre": nombre,
            "descripcion": desc,
            "direccion": None,
            "latitud": lat,
            "longitud": lon,
            "gasto_min": gmin,
            "gasto_max": gmax,
            "duracion_sugerida_min": dur,
            "estado": True,
            "fuente": "dataset-osm-chaski",
            "external_id": None,
            "fecha_actualizacion": "2026-09-09T00:00:00Z",
        }
        nuevos.append(row)
        if cat not in cat_map:
            print("  WARN: categoria sin id:", cat)
            continue
        vinculos.append({"lugar_id": row["id"], "categoria_id": cat_map[cat]})

    if nuevos:
        creados = post(URL, "lugares", nuevos)
        print(f"lugares insertados: {len(creados)}")
        # re-mapear vinculos con ids reales por nombre
        if creados:
            nom_id = {c["nombre"]: c["id"] for c in creados}
            links = [{"lugar_id": nom_id[n], "categoria_id": cat_map[CATEGORIAS[c]]}
                     for n, c, *_ in [t for t in LUGARES if t[0] in nom_id]]
            if links:
                post(URL, "lugares_categorias", links)
                print(f"vinculos lugar-categoria: {len(links)}")
    else:
        print("nada por insertar")


if __name__ == "__main__":
    main()
