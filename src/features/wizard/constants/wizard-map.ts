/**
 * Configuración, constantes y funciones de utilidad para la pantalla de Mapa Serie AX.
 */

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Coordenadas iniciales de Lima Metropolitana */
export const LIMA_INICIAL: MapRegion = {
  latitude: -12.121,
  longitude: -77.03,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};

/** Endpoint público de teselas OpenStreetMap (OSM) */
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Determina el modo de cartografía óptimo:
 * - En Android sin API key personalizada (por ejemplo, en Expo Go), se activa
 *   la capa de teselas OpenStreetMap (UrlTile) y mapType="none", evitando el
 *   fondo negro que genera la falta de autorización del SDK nativo de Google Play Services.
 * - Si se dispone de API Key o en iOS, se utiliza la cartografía nativa ("standard").
 */
export function resolveMapCartographyMode(
  isAndroid: boolean,
  hasCustomGoogleKey: boolean
): { useOsmTiles: boolean; mapType: 'none' | 'standard' } {
  const useOsmTiles = isAndroid ? !hasCustomGoogleKey : false;
  return {
    useOsmTiles,
    mapType: useOsmTiles ? 'none' : 'standard',
  };
}

/** Formatea coordenadas geográficas para el ticket Serie AX */
export function formatMapCoordinates(lat: number, lng: number): string {
  return `LAT: ${lat.toFixed(4)}°   LNG: ${lng.toFixed(4)}°`;
}

/** Formatea dirección a partir de datos de geocodificación inversa */
export function formatReverseGeocodeLabel(place: {
  street?: string | null;
  name?: string | null;
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
}): string {
  const primary = place.street || place.name;
  const secondary = place.district || place.subregion || place.city;
  const parts = [primary, secondary].filter(Boolean);
  return parts.join(', ');
}
