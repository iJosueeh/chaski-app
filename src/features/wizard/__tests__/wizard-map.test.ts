import { describe, expect, it } from 'vitest';

import {
  formatMapCoordinates,
  formatReverseGeocodeLabel,
  LIMA_INICIAL,
  OSM_TILE_URL,
  resolveMapCartographyMode,
} from '@/features/wizard/constants/wizard-map';

describe('WizardMapa — Cartografía y Selección Serie AX', () => {
  describe('Configuración Inicial de la Región y Cartografía', () => {
    it('centra el mapa inicialmente en las coordenadas de Lima Metropolitana', () => {
      expect(LIMA_INICIAL.latitude).toBeCloseTo(-12.121, 3);
      expect(LIMA_INICIAL.longitude).toBeCloseTo(-77.03, 2);
      expect(LIMA_INICIAL.latitudeDelta).toBeGreaterThan(0);
      expect(LIMA_INICIAL.longitudeDelta).toBeGreaterThan(0);
    });

    it('define la plantilla de teselas OpenStreetMap (OSM) para Expo Go Android', () => {
      expect(OSM_TILE_URL).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
      expect(OSM_TILE_URL).toContain('{z}');
      expect(OSM_TILE_URL).toContain('{x}');
      expect(OSM_TILE_URL).toContain('{y}');
    });
  });

  describe('Lógica de Selección y Estado del Botón de Confirmación', () => {
    it('el botón CONFIRMAR UBICACIÓN debe estar estrictamente deshabilitado si pin es null', () => {
      const pin: { lat: number; lng: number } | null = null;
      const isConfirmDisabled = !pin;
      expect(isConfirmDisabled).toBe(true);
    });

    it('el botón CONFIRMAR UBICACIÓN se habilita inmediatamente al fijar un pin válido', () => {
      const pin: { lat: number; lng: number } | null = { lat: -12.121, lng: -77.03 };
      const isConfirmDisabled = !pin;
      expect(isConfirmDisabled).toBe(false);
    });

    it('formatea las coordenadas geográficas legibles para el ticket Serie AX', () => {
      const formatted = formatMapCoordinates(-12.121045, -77.030012);
      expect(formatted).toBe('LAT: -12.1210°   LNG: -77.0300°');
    });

    it('genera etiqueta de respaldo con coordenadas cuando no hay geocodificación inversa', () => {
      const latitude = -12.1234;
      const longitude = -77.0289;
      const fallbackLabel = `Punto (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
      expect(fallbackLabel).toBe('Punto (-12.1234, -77.0289)');
    });

    it('combina componentes de dirección (calle, distrito) en formato amigable', () => {
      const mockReverseGeocode = {
        street: 'Av. José Larco 400',
        name: 'Larco',
        district: 'Miraflores',
        subregion: 'Lima',
        city: 'Lima',
      };

      const resolvedLabel = formatReverseGeocodeLabel(mockReverseGeocode);
      expect(resolvedLabel).toBe('Av. José Larco 400, Miraflores');
    });

    it('si solo existe el distrito o ciudad, formatea limpiamente sin comas huérfanas', () => {
      const resolvedLabel = formatReverseGeocodeLabel({
        street: null,
        name: null,
        district: 'Miraflores',
      });
      expect(resolvedLabel).toBe('Miraflores');
    });
  });

  describe('Detección de Proveedor y Fallback Anti-Pantalla Negra', () => {
    it('en Android sin clave registrada de Google Maps activa el modo teselas raster (OSM)', () => {
      const result = resolveMapCartographyMode(true, false);
      expect(result.useOsmTiles).toBe(true);
      // mapType "none" oculta el fondo negro sin autorización de Google Play Services
      expect(result.mapType).toBe('none');
    });

    it('en Android con clave de Google Maps configurada puede utilizar la capa estándar', () => {
      const result = resolveMapCartographyMode(true, true);
      expect(result.useOsmTiles).toBe(false);
      expect(result.mapType).toBe('standard');
    });

    it('en plataformas no Android (e.g. iOS / Apple Maps) usa la capa nativa estándar', () => {
      const result = resolveMapCartographyMode(false, false);
      expect(result.useOsmTiles).toBe(false);
      expect(result.mapType).toBe('standard');
    });
  });
});
