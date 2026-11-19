import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';
import {
  cachePlaceCoverImage,
  clearPlaceCoverImagesCache,
  getRouteCoverImage,
  loadPlaceCoverImages,
} from '../utils/route-image';

vi.mock('@/features/places/services/places-storage.service', () => ({
  getPlaceImageUrl: vi.fn((path: string) => `https://mock.supabase.co/storage/v1/object/public/places/${path}`),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('getRouteCoverImage', () => {
  beforeEach(() => {
    clearPlaceCoverImagesCache();
  });

  it('retorna null si el plan es nulo o no tiene paradas ni fallback', () => {
    expect(getRouteCoverImage(null)).toBeNull();
    expect(getRouteCoverImage(undefined)).toBeNull();
    expect(getRouteCoverImage({ paradas: [] } as unknown as GeneratedPlan)).toBeNull();
  });

  it('retorna imagen_portada si es una URL completa', () => {
    const plan = {
      paradas: [
        {
          place: {
            id: 'p1',
            nombre: 'Museo de Arte',
            imagen_portada: 'https://images.unsplash.com/photo-123.jpg',
          },
        },
      ],
    } as unknown as GeneratedPlan;

    expect(getRouteCoverImage(plan)).toBe('https://images.unsplash.com/photo-123.jpg');
  });

  it('resuelve storage_path si imagen_portada es una ruta relativa', () => {
    const plan = {
      paradas: [
        {
          place: {
            id: 'p1',
            nombre: 'Huaca Pucllana',
            imagen_portada: 'places/pucllana.jpg',
          },
        },
      ],
    } as unknown as GeneratedPlan;

    expect(getRouteCoverImage(plan)).toBe(
      'https://mock.supabase.co/storage/v1/object/public/places/places/pucllana.jpg',
    );
  });

  it('busca la imagen en paradas posteriores si la primera no tiene foto', () => {
    const plan = {
      paradas: [
        {
          place: {
            id: 'p1',
            nombre: 'Parque Kennedy',
            imagen_portada: null,
          },
        },
        {
          place: {
            id: 'p2',
            nombre: 'Malecón de Miraflores',
            imagen_portada: 'https://images.unsplash.com/photo-malecon.jpg',
          },
        },
      ],
    } as unknown as GeneratedPlan;

    expect(getRouteCoverImage(plan)).toBe('https://images.unsplash.com/photo-malecon.jpg');
  });

  it('resuelve foto desde la cache por lugar_id cuando la parada no tenia foto en el snapshot', () => {
    const cantaRanaId = 'a60114f4-0972-43c1-b05a-c0455f0476d0';
    const cantaRanaUrl = 'https://mock.supabase.co/canta_rana.jpg';
    cachePlaceCoverImage(cantaRanaId, 'Canta Rana', cantaRanaUrl);

    const plan = {
      paradas: [
        {
          place: {
            id: cantaRanaId,
            nombre: 'Canta Rana',
            imagen_portada: null,
            imagenes: [],
          },
        },
      ],
    } as unknown as GeneratedPlan;

    expect(getRouteCoverImage(plan)).toBe(cantaRanaUrl);
  });

  it('resuelve foto usando el fallback cuando el snapshot es nulo pero la solicitud es de Canta Rana', () => {
    const cantaRanaId = 'a60114f4-0972-43c1-b05a-c0455f0476d0';
    const cantaRanaUrl = 'https://mock.supabase.co/canta_rana.jpg';
    cachePlaceCoverImage(cantaRanaId, 'Canta Rana', cantaRanaUrl);

    // Sin snapshot, solo inicio_descripcion
    expect(getRouteCoverImage(null, 'Expedición desde Canta Rana')).toBe(cantaRanaUrl);
    expect(getRouteCoverImage(null, 'Canta Rana')).toBe(cantaRanaUrl);
  });

  it('loadPlaceCoverImages carga e indexa imagenes de lugares', async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === 'lugares') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'p-1',
                  nombre: 'Canta Rana',
                  lugares_imagenes: [
                    {
                      storage_path: 'p-1/portada.jpg',
                      es_portada: true,
                    },
                  ],
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                lugar_id: 'p-1',
                storage_path: 'p-1/portada.jpg',
                es_portada: true,
              },
            ],
            error: null,
          }),
        }),
      };
    });

    const mockClient = { from: mockFrom } as any;
    await loadPlaceCoverImages(mockClient);

    expect(getRouteCoverImage(null, 'Canta Rana')).toBe(
      'https://mock.supabase.co/storage/v1/object/public/places/p-1/portada.jpg',
    );
  });
});
