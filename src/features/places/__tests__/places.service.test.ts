import { describe, expect, it, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { getActivePlaces, getPlaceById, mapPlaceImages } from '../services/places.service';

vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      storage: {
        from: vi.fn(),
      },
      rpc: vi.fn(),
    },
  };
});

describe('Places Service - Multimedia y Catálogo Patrimonial', () => {
  const mockFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;
  const mockStorageFrom = supabase.storage.from as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock por defecto para getPublicUrl
    mockStorageFrom.mockReturnValue({
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://mock-supabase.co/storage/v1/object/public/places/${path}` },
      })),
    });
  });

  describe('mapPlaceImages()', () => {
    it('retorna portada nula y lista vacía si no hay imágenes o es nulo/indefinido', () => {
      expect(mapPlaceImages(null)).toEqual({ imagen_portada: null, imagenes: [] });
      expect(mapPlaceImages(undefined)).toEqual({ imagen_portada: null, imagenes: [] });
      expect(mapPlaceImages([])).toEqual({ imagen_portada: null, imagenes: [] });
    });

    it('extrae correctamente la imagen designada con es_portada = true', () => {
      const raw = [
        {
          id: 'img-1',
          lugar_id: 'lugar-1',
          storage_path: 'lugar-1/img-1.jpg',
          es_portada: false,
          orden: 1,
          created_at: '2026-10-14T10:00:00Z',
        },
        {
          id: 'img-2',
          lugar_id: 'lugar-1',
          storage_path: 'lugar-1/img-2.jpg',
          es_portada: true,
          orden: 2,
          created_at: '2026-10-14T10:05:00Z',
        },
      ];

      const result = mapPlaceImages(raw);
      expect(result.imagen_portada).toBe('https://mock-supabase.co/storage/v1/object/public/places/lugar-1/img-2.jpg');
      expect(result.imagenes).toHaveLength(2);
      expect(result.imagenes[0].id).toBe('img-1');
      expect(result.imagenes[1].id).toBe('img-2');
      expect(result.imagenes[1].es_portada).toBe(true);
    });

    it('si ninguna imagen tiene es_portada = true, usa la primera en orden como fallback', () => {
      const raw = [
        {
          id: 'img-b',
          lugar_id: 'lugar-1',
          storage_path: 'lugar-1/img-b.jpg',
          es_portada: false,
          orden: 2,
          created_at: '2026-10-14T10:00:00Z',
        },
        {
          id: 'img-a',
          lugar_id: 'lugar-1',
          storage_path: 'lugar-1/img-a.jpg',
          es_portada: false,
          orden: 1,
          created_at: '2026-10-14T10:00:00Z',
        },
      ];

      const result = mapPlaceImages(raw);
      expect(result.imagen_portada).toBe('https://mock-supabase.co/storage/v1/object/public/places/lugar-1/img-a.jpg');
      expect(result.imagenes[0].id).toBe('img-a');
      expect(result.imagenes[1].id).toBe('img-b');
    });

    it('ordena las imágenes ascendentemente por orden y luego por created_at', () => {
      const raw = [
        {
          id: 'img-3',
          lugar_id: 'lugar-1',
          storage_path: 'lugar-1/img-3.jpg',
          es_portada: false,
          orden: 1,
          created_at: '2026-10-14T12:00:00Z',
        },
        {
          id: 'img-1',
          lugar_id: 'lugar-1',
          storage_path: 'lugar-1/img-1.jpg',
          es_portada: false,
          orden: 0,
          created_at: '2026-10-14T10:00:00Z',
        },
        {
          id: 'img-2',
          lugar_id: 'lugar-1',
          storage_path: 'lugar-1/img-2.jpg',
          es_portada: false,
          orden: 1,
          created_at: '2026-10-14T11:00:00Z',
        },
      ];

      const result = mapPlaceImages(raw);
      expect(result.imagenes.map(i => i.id)).toEqual(['img-1', 'img-2', 'img-3']);
    });
  });

  describe('getActivePlaces()', () => {
    it('retorna la lista de destinos activos con sus portadas y galerías mapeadas', async () => {
      const mockDbData = [
        {
          id: 'lugar-1',
          nombre: 'Huaca Pucllana',
          descripcion: 'Templo ceremonial',
          latitud: -12.111,
          longitud: -77.033,
          direccion: 'Calle General Borgoño 8ra cuadra',
          gasto_min: 15,
          gasto_max: 30,
          duracion_sugerida_min: 60,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: null,
          tipo_disponibilidad: null,
          fecha_actualizacion: '2026-10-14T00:00:00Z',
          horarios_lugar: [{ id: 'h1', dia_semana: 1, hora_apertura: '09:00', hora_cierre: '17:00' }],
          lugares_categorias: [{ categorias: { id: 'c1', nombre: 'Cultura' } }],
          lugares_etiquetas: [{ etiquetas: { id: 't1', nombre: 'Arqueología' } }],
          lugares_imagenes: [
            {
              id: 'img-1',
              lugar_id: 'lugar-1',
              storage_path: 'lugar-1/pucllana-cover.jpg',
              es_portada: true,
              orden: 0,
              created_at: '2026-10-14T10:00:00Z',
            },
          ],
        },
        {
          id: 'lugar-2',
          nombre: 'Parque Kennedy',
          descripcion: 'Parque central',
          latitud: -12.12,
          longitud: -77.03,
          direccion: null,
          gasto_min: 0,
          gasto_max: 0,
          duracion_sugerida_min: 30,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: null,
          tipo_disponibilidad: 'LIBRE_ACCESO',
          fecha_actualizacion: '2026-10-14T00:00:00Z',
          horarios_lugar: [],
          lugares_categorias: [{ categorias: { id: 'c2', nombre: 'Parques' } }],
          lugares_etiquetas: [],
          lugares_imagenes: [], // Sin imágenes registradas
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDbData, error: null }),
      };
      mockFrom.mockReturnValue(mockQuery);

      const response = await getActivePlaces();

      expect(response.error).toBeNull();
      expect(response.data).toHaveLength(2);

      // Lugar 1 con portada
      const lugar1 = response.data![0];
      expect(lugar1.id).toBe('lugar-1');
      expect(lugar1.imagen_portada).toBe(
        'https://mock-supabase.co/storage/v1/object/public/places/lugar-1/pucllana-cover.jpg'
      );
      expect(lugar1.imagenes).toHaveLength(1);
      expect(lugar1.categorias).toEqual([{ id: 'c1', nombre: 'Cultura' }]);

      // Lugar 2 sin imágenes (funciona limpiamente sin fallos)
      const lugar2 = response.data![1];
      expect(lugar2.id).toBe('lugar-2');
      expect(lugar2.imagen_portada).toBeNull();
      expect(lugar2.imagenes).toEqual([]);
    });

    it('elimina duplicados defensivamente si la consulta a Supabase retorna filas repetidas por el mismo id', async () => {
      const mockDbData = [
        {
          id: 'lugar-duplicado-1',
          nombre: 'Canta Rana',
          descripcion: 'Cebichería clásica',
          latitud: -12.146,
          longitud: -77.022,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: 'seed:canta-rana',
          tipo_disponibilidad: 'HORARIO_REGISTRADO',
          lugares_categorias: [],
          lugares_imagenes: [],
        },
        {
          id: 'lugar-duplicado-1', // Misma clave primaria (artefacto de join o consulta)
          nombre: 'Canta Rana',
          descripcion: 'Cebichería clásica repetida',
          latitud: -12.146,
          longitud: -77.022,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: 'seed:canta-rana',
          tipo_disponibilidad: 'HORARIO_REGISTRADO',
          lugares_categorias: [],
          lugares_imagenes: [],
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDbData, error: null }),
      };
      mockFrom.mockReturnValue(mockQuery);

      const response = await getActivePlaces();
      expect(response.error).toBeNull();
      expect(response.data).toHaveLength(1);
      expect(response.data![0].id).toBe('lugar-duplicado-1');
    });

    it('preserva lugares distintos con nombres idénticos si poseen identificadores primarios diferentes', async () => {
      const mockDbData = [
        {
          id: 'lugar-sucursal-1',
          nombre: 'Antigua Bodega Dalmacia',
          descripcion: 'Sede Principal',
          latitud: -12.132,
          longitud: -77.026,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: 'seed:antigua-bodega-dalmacia-1',
          tipo_disponibilidad: 'HORARIO_REGISTRADO',
          lugares_categorias: [],
          lugares_imagenes: [],
        },
        {
          id: 'lugar-sucursal-2',
          nombre: 'Antigua Bodega Dalmacia',
          descripcion: 'Segunda Sede',
          latitud: -12.135,
          longitud: -77.028,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: 'seed:antigua-bodega-dalmacia-2',
          tipo_disponibilidad: 'HORARIO_REGISTRADO',
          lugares_categorias: [],
          lugares_imagenes: [],
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDbData, error: null }),
      };
      mockFrom.mockReturnValue(mockQuery);

      const response = await getActivePlaces();
      expect(response.error).toBeNull();
      // No debe hacer deduplicación superficial por nombre: conserva ambos porque son IDs diferentes
      expect(response.data).toHaveLength(2);
      expect(response.data![0].id).toBe('lugar-sucursal-1');
      expect(response.data![1].id).toBe('lugar-sucursal-2');
    });

    it('deduplica categorías repetidas dentro de las relaciones de un destino', async () => {
      const mockDbData = [
        {
          id: 'lugar-cat-1',
          nombre: 'Huaca Pucllana (Museo de Sitio)',
          latitud: -12.111,
          longitud: -77.033,
          estado: true,
          fuente: 'dataset-osm-chaski',
          external_id: 'seed:huaca-pucllana',
          tipo_disponibilidad: 'HORARIO_REGISTRADO',
          lugares_categorias: [
            { categorias: { id: 'c-cultura', nombre: 'Cultura' } },
            { categorias: { id: 'c-cultura', nombre: 'Cultura' } }, // Duplicado de relación
            { categorias: { id: 'c-historia', nombre: 'Historia' } },
          ],
          lugares_imagenes: [],
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDbData, error: null }),
      };
      mockFrom.mockReturnValue(mockQuery);

      const response = await getActivePlaces();
      expect(response.error).toBeNull();
      expect(response.data![0].categorias).toHaveLength(2);
      expect(response.data![0].categorias).toEqual([
        { id: 'c-cultura', nombre: 'Cultura' },
        { id: 'c-historia', nombre: 'Historia' },
      ]);
    });

    it('retorna error cuando la consulta a Supabase falla', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database connection timeout' } }),
      };
      mockFrom.mockReturnValue(mockQuery);

      const response = await getActivePlaces();
      expect(response.data).toBeNull();
      expect(response.error?.message).toBe('Database connection timeout');
    });
  });

  describe('getPlaceById()', () => {
    it('retorna el detalle del destino con su galería ordenada y portada resuelta', async () => {
      const mockPlaceData = {
        id: 'lugar-detail-1',
        nombre: 'Museo Amano',
        descripcion: 'Textiles precolombinos',
        latitud: -12.114,
        longitud: -77.04,
        direccion: 'Calle Retiro 160',
        gasto_min: 10,
        gasto_max: 25,
        duracion_sugerida_min: 60,
        estado: true,
        fuente: 'dataset-osm-chaski',
        external_id: null,
        tipo_disponibilidad: null,
        fecha_actualizacion: '2026-10-14T00:00:00Z',
        horarios_lugar: [],
        lugares_categorias: [],
        lugares_etiquetas: [],
        lugares_imagenes: [
          {
            id: 'img-det-2',
            lugar_id: 'lugar-detail-1',
            storage_path: 'lugar-detail-1/textil-paracas.jpg',
            es_portada: false,
            orden: 1,
            created_at: '2026-10-14T11:00:00Z',
          },
          {
            id: 'img-det-1',
            lugar_id: 'lugar-detail-1',
            storage_path: 'lugar-detail-1/fachada-cover.jpg',
            es_portada: true,
            orden: 0,
            created_at: '2026-10-14T10:00:00Z',
          },
        ],
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockPlaceData, error: null }),
      };
      mockFrom.mockReturnValue(mockQuery);

      const response = await getPlaceById('lugar-detail-1');

      expect(response.error).toBeNull();
      expect(response.data?.id).toBe('lugar-detail-1');
      expect(response.data?.imagen_portada).toBe(
        'https://mock-supabase.co/storage/v1/object/public/places/lugar-detail-1/fachada-cover.jpg'
      );
      expect(response.data?.imagenes).toHaveLength(2);
      expect(response.data?.imagenes?.[0].id).toBe('img-det-1');
      expect(response.data?.imagenes?.[1].id).toBe('img-det-2');
    });

    it('retorna data: null si el lugar no existe (maybeSingle retorna null)', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockFrom.mockReturnValue(mockQuery);

      const response = await getPlaceById('non-existent');
      expect(response.data).toBeNull();
      expect(response.error).toBeNull();
    });
  });
});
