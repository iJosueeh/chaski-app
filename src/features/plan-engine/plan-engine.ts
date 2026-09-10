/**
 * Motor de planes Chaski — greedy por cercanía con 3 variantes.
 *
 * Entrada: la solicitud del wizard (WizardPlanRequest) + los lugares de
 * Supabase. Salida: 3 planes (íntimo / equilibrado / explorador) con
 * paradas ordenadas por cercanía, costos y tiempos calculados.
 *
 * Reglas del motor:
 *  - Filtro duro: presupuesto (gasto_max del lugar <= presupuesto restante)
 *    e intereses (si el usuario eligió, filtra por categoría).
 *  - Orden: nearest-neighbor desde el punto de partida, con tiempo de
 *    traslado estimado a 4.5 km/h caminando (ajustado por movilidad).
 *  - Presupuesto total: suma de gasto_max <= presupuesto del usuario.
 *  - Tiempo: suma de duracion_sugerida_min + traslados <= minutosTotales.
 *  - 3 variantes cambian el MAX_STOPS y el sesgo de selección.
 */
import type { Place } from '@/features/places/interface/places.interface';
import type { WizardPlanRequest } from '@/features/wizard/context/wizard-context';

export interface PlanStop {
  place: Place;
  orden: number;
  llegada: string; // "HH:MM" estimada
  duracion_min: number;
  traslado_desde_anterior_min: number;
  costo_estimado: number; // gasto_max del lugar (peor caso)
}

export interface GeneratedPlan {
  id: string;
  titulo: string;
  descripcion: string;
  variante: 'intimo' | 'equilibrado' | 'explorador';
  paradas: PlanStop[];
  duracion_total_min: number;
  costo_total: number;
  distancia_km_aprox: number;
}

/* ── Utilidades ─────────────────────────────────────────────────────────── */

const VELOCIDAD_KMH: Record<string, number> = {
  caminando: 4.5,
  publico: 12,
  aplicativo: 20,
};

function haversineKm(
  lat1: number, lon1: number, lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Minutos de traslado entre 2 puntos según la movilidad elegida. */
function trasladoMin(km: number, movilidad: string | null): number {
  const v = VELOCIDAD_KMH[movilidad ?? 'caminando'] ?? 4.5;
  return Math.max(5, Math.round((km / v) * 60));
}

function hhmmAdd(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = ((h * 60 + m + min) % (24 * 60) + 24 * 60) % (24 * 60);
  const H = String(Math.floor(total / 60)).padStart(2, '0');
  const M = String(total % 60).padStart(2, '0');
  return `${H}:${M}`;
}

/** Mapea los intereses del wizard a categorías de la tabla. */
function categoriasDeIntereses(intereses: string[]): string[] | null {
  if (!intereses.length) return null;
  const mapa: Record<string, string[]> = {
    'Gastronomía': ['Gastronomía'],
    'Cultura': ['Cultura'],
    'Naturaleza': ['Parques', 'Miradores'],
    'Historia': ['Historia', 'Cultura'],
    'Compras': [],
    'Nocturno': [],
  };
  const out = new Set<string>();
  for (const i of intereses) for (const c of mapa[i] ?? []) out.add(c);
  return out.size ? [...out] : null;
}

/* ── El motor ───────────────────────────────────────────────────────────── */

const VARIANTES: {
  id: 'intimo' | 'equilibrado' | 'explorador';
  maxStops: number;
  titulo: string;
  sesgo: 'point' | 'recommended' | 'casual';
  /** Fracción de presupuesto/tiempo usada — fuerza diversidad entre variantes. */
  presupuestoFrac: number;
  tiempoFrac: number;
}[] = [
  { id: 'intimo', maxStops: 3, titulo: 'Ruta Íntima', sesgo: 'point', presupuestoFrac: 0.6, tiempoFrac: 0.55 },
  { id: 'equilibrado', maxStops: 4, titulo: 'Plan Equilibrado', sesgo: 'recommended', presupuestoFrac: 0.85, tiempoFrac: 0.8 },
  { id: 'explorador', maxStops: 5, titulo: 'Ruta Exploradora', sesgo: 'casual', presupuestoFrac: 1, tiempoFrac: 1 },
];

export function generarPlanes(
  request: WizardPlanRequest,
  lugares: Place[],
): GeneratedPlan[] {
  const origen = request.ubicacion;
  if (!origen?.lat || !origen?.lng) return [];

  const catsDeseadas = categoriasDeIntereses(request.intereses);

  // Filtro duro: cercanía razonable (<=12km del origen) e intereses si hay.
  const candidatos = lugares.filter((l) => {
    const d = haversineKm(origen.lat!, origen.lng!, l.latitud, l.longitud);
    if (d > 12) return false;
    if (catsDeseadas) {
      const catsLugar = (l.categorias ?? []).map((c) => c.nombre);
      if (!catsLugar.some((c) => catsDeseadas.includes(c))) return false;
    }
    return true;
  });
  if (candidatos.length < 3) return [];

  const presupuesto = request.presupuesto ?? 0;

  return VARIANTES.map((v) => {
    // Diversidad: cada variante usa una fracción distinta de presupuesto/tiempo,
    // así el Íntima no devuelve exactamente el mismo plan que la Exploradora.
    const presupuestoV = Math.floor(presupuesto * v.presupuestoFrac);
    const minutosV = Math.floor((request.minutosTotales ?? 240) * v.tiempoFrac);
    const paradas: PlanStop[] = [];
    let lat = origen.lat!, lon = origen.lng!;
    let costoAcum = 0;
    let tiempoAcum = 0;
    let distAcum = 0;
    const usados = new Set<string>();

    for (let i = 0; i < v.maxStops; i++) {
      // Elegir el mejor candidato: más cercano, con bonus por tier-sesgo,
      // descartando los que rompan presupuesto/tiempo.
      let mejor: { lugar: Place; km: number; t: number; score: number } | null = null;
      for (const l of candidatos) {
        if (usados.has(l.id)) continue;
        const km = haversineKm(lat, lon, l.latitud, l.longitud);
        const t = trasladoMin(km, request.movilidad);
        const costoLugar = l.gasto_max ?? 0;
        if (costoAcum + costoLugar > presupuestoV) continue;
        const durLugar = l.duracion_sugerida_min ?? 30;
        if (tiempoAcum + t + durLugar > minutosV) continue;

        const tierBonus =
          durLugar === 60 && v.sesgo === 'point' ? 0.25 :
          durLugar === 40 && v.sesgo === 'recommended' ? 0.2 :
          durLugar <= 30 && v.sesgo === 'casual' ? 0.15 : 0;
        const score = km * (1 - tierBonus);

        if (!mejor || score < mejor.score) mejor = { lugar: l, km, t, score };
      }
      if (!mejor) break;

      usados.add(mejor.lugar.id);
      distAcum += mejor.km;
      tiempoAcum += mejor.t + (mejor.lugar.duracion_sugerida_min ?? 30);
      costoAcum += mejor.lugar.gasto_max ?? 0;
      const prev = paradas[paradas.length - 1];
      paradas.push({
        place: mejor.lugar,
        orden: paradas.length + 1,
        llegada: hhmmAdd(
          request.horaInicio ?? '09:00',
          paradas.reduce((a, p) => a + p.traslado_desde_anterior_min + p.duracion_min, mejor.t),
        ),
        duracion_min: mejor.lugar.duracion_sugerida_min ?? 30,
        traslado_desde_anterior_min: mejor.t,
        costo_estimado: mejor.lugar.gasto_max ?? 0,
      });
      lat = mejor.lugar.latitud;
      lon = mejor.lugar.longitud;
      void prev;
    }

    if (!paradas.length) {
      return {
        id: `${v.id}-${Date.now()}`,
        titulo: v.titulo,
        descripcion: 'No encontramos paradas dentro de tus filtros. Prueba con más presupuesto o tiempo.',
        variante: v.id,
        paradas: [],
        duracion_total_min: 0,
        costo_total: 0,
        distancia_km_aprox: 0,
      };
    }

    return {
      id: `${v.id}-${Date.now()}`,
      titulo: v.titulo,
      descripcion: `${paradas.length} ${paradas.length === 1 ? 'parada' : 'paradas'} desde ${paradas[0].place.nombre}`,
      variante: v.id,
      paradas,
      duracion_total_min: tiempoAcum,
      costo_total: costoAcum,
      distancia_km_aprox: Math.round(distAcum * 10) / 10,
    };
  }).filter((plan) => plan.paradas.length > 0);
}
