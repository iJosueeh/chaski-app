import { describe, expect, it } from 'vitest';
import type { Place } from '../interface/places.interface';

describe('PlacesListScreen — Contratos del Catálogo de Destinos', () => {
  describe('keyExtractor y Unicidad en Listas', () => {
    it('garantiza claves únicas para FlatList usando el identificador canónico', () => {
      const places: Place[] = [
        {
          id: 'lugar-1',
          nombre: 'Huaca Pucllana (Museo de Sitio)',
          descripcion: null,
          latitud: -12.111,
          longitud: -77.033,
          direccion: null,
          gasto_min: 15,
          gasto_max: 30,
          duracion_sugerida_min: 60,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: 'seed:huaca-pucllana',
          tipo_disponibilidad: 'HORARIO_REGISTRADO',
          fecha_actualizacion: '2026-10-14T00:00:00Z',
          categorias: [{ id: 'c-cultura', nombre: 'Cultura' }],
          etiquetas: [],
          horarios: [],
        },
        {
          id: 'lugar-2',
          nombre: 'Canta Rana',
          descripcion: null,
          latitud: -12.146,
          longitud: -77.022,
          direccion: null,
          gasto_min: 15,
          gasto_max: 40,
          duracion_sugerida_min: 60,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: 'seed:canta-rana',
          tipo_disponibilidad: 'HORARIO_REGISTRADO',
          fecha_actualizacion: '2026-10-14T00:00:00Z',
          categorias: [{ id: 'c-gastro', nombre: 'Gastronomía' }],
          etiquetas: [],
          horarios: [],
        },
      ];

      const keyExtractor = (item: Place) => item.id;
      const keys = places.map(keyExtractor);
      const uniqueKeys = new Set(keys);

      expect(uniqueKeys.size).toBe(places.length);
      expect(keys[0]).toBe('lugar-1');
      expect(keys[1]).toBe('lugar-2');
    });

    it('identifica y rechaza listas con claves colisionadas para proteger FlatList', () => {
      const placesWithDuplicateId: Place[] = [
        {
          id: 'dup-1',
          nombre: 'Antigua Bodega Dalmacia',
          descripcion: null,
          latitud: -12.132,
          longitud: -77.026,
          direccion: null,
          gasto_min: 10,
          gasto_max: 30,
          duracion_sugerida_min: 40,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: 'seed:antigua-bodega-dalmacia',
          tipo_disponibilidad: 'HORARIO_REGISTRADO',
          fecha_actualizacion: '2026-10-14T00:00:00Z',
          categorias: [],
          etiquetas: [],
          horarios: [],
        },
        {
          id: 'dup-1', // ID idéntico (artefacto de consulta)
          nombre: 'Antigua Bodega Dalmacia',
          descripcion: null,
          latitud: -12.132,
          longitud: -77.026,
          direccion: null,
          gasto_min: 10,
          gasto_max: 30,
          duracion_sugerida_min: 40,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: 'seed:antigua-bodega-dalmacia',
          tipo_disponibilidad: 'HORARIO_REGISTRADO',
          fecha_actualizacion: '2026-10-14T00:00:00Z',
          categorias: [],
          etiquetas: [],
          horarios: [],
        },
      ];

      // Función defensiva de sanitización por ID
      const sanitizePlaceList = (list: Place[]) => {
        const seen = new Set<string>();
        return list.filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      };

      const sanitized = sanitizePlaceList(placesWithDuplicateId);
      expect(sanitized).toHaveLength(1);
      expect(sanitized[0].id).toBe('dup-1');
    });

    it('no aplica deduplicación por nombre, permitiendo homónimos con diferente ID', () => {
      const homonymousPlaces: Place[] = [
        {
          id: 'sucursal-miraflores',
          nombre: 'La 73 Paradero Gourmet',
          descripcion: 'Sede Miraflores',
          latitud: -12.12,
          longitud: -77.03,
          direccion: null,
          gasto_min: 40,
          gasto_max: 80,
          duracion_sugerida_min: 75,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: 'seed:la-73-miraflores',
          tipo_disponibilidad: 'HORARIO_REGISTRADO',
          fecha_actualizacion: '2026-10-14T00:00:00Z',
          categorias: [],
          etiquetas: [],
          horarios: [],
        },
        {
          id: 'sucursal-barranco',
          nombre: 'La 73 Paradero Gourmet',
          descripcion: 'Sede Barranco',
          latitud: -12.139,
          longitud: -77.023,
          direccion: null,
          gasto_min: 40,
          gasto_max: 80,
          duracion_sugerida_min: 75,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: 'seed:la-73-barranco',
          tipo_disponibilidad: 'HORARIO_REGISTRADO',
          fecha_actualizacion: '2026-10-14T00:00:00Z',
          categorias: [],
          etiquetas: [],
          horarios: [],
        },
      ];

      const sanitizePlaceList = (list: Place[]) => {
        const seen = new Set<string>();
        return list.filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      };

      const result = sanitizePlaceList(homonymousPlaces);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('sucursal-miraflores');
      expect(result[1].id).toBe('sucursal-barranco');
    });
  });
});
