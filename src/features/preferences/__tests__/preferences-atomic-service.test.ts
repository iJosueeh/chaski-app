import { describe, expect, it, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  saveUserPreferencesAtomic,
  saveUserPreferences,
} from '../services/preferences.service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('Servicio de Preferencias — Persistencia Atómica RPC (save_user_preferences_atomic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveUserPreferencesAtomic', () => {
    it('invoca save_user_preferences_atomic con los parámetros exactos requeridos por la firma SQL', async () => {
      const mockResult = {
        success: true,
        usuario_id: 'user-123',
        categories_saved: 2,
        updated_at: '2026-10-11T21:00:00Z',
      };

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockResult,
        error: null,
      } as any);

      const response = await saveUserPreferencesAtomic({
        categoryIds: ['cat-a', 'cat-b'],
        gastoMin: 20,
        gastoMax: 60,
        movilidadPreferida: 'caminando',
        actualizarMovilidad: true,
      });

      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc).toHaveBeenCalledWith('save_user_preferences_atomic', {
        p_category_ids: ['cat-a', 'cat-b'],
        p_gasto_min: 20,
        p_gasto_max: 60,
        p_movilidad_preferida: 'caminando',
        p_actualizar_movilidad: true,
      });

      expect(response.error).toBeNull();
      expect(response.data).toEqual(mockResult);
    });

    it('preserva movilidad_preferida enviando actualizarMovilidad = false por defecto', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      } as any);

      await saveUserPreferencesAtomic({
        categoryIds: ['cat-a'],
        gastoMin: null,
        gastoMax: null,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('save_user_preferences_atomic', {
        p_category_ids: ['cat-a'],
        p_gasto_min: null,
        p_gasto_max: null,
        p_movilidad_preferida: null,
        p_actualizar_movilidad: false,
      });
    });

    it('retorna error recuperable sin fallback cuando la RPC falla', async () => {
      const rpcError = {
        message: 'INVALID_CATEGORIES: Una o más categorías seleccionadas son inválidas',
        code: '23503',
      };

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: rpcError,
      } as any);

      const response = await saveUserPreferencesAtomic({
        categoryIds: ['cat-invalida'],
        gastoMin: null,
        gastoMax: null,
      });

      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(response.data).toBeNull();
      expect(response.error).toEqual(rpcError);
    });
  });

  describe('saveUserPreferences (adaptador retrocompatible)', () => {
    it('redirige exclusivamente a la RPC atómica y no ejecuta llamadas directas a tablas', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      } as any);

      const response = await saveUserPreferences({
        userId: 'user-legacy-123',
        movilidadPreferida: 'transporte_publico',
        gastoMin: 15,
        gastoMax: 45,
        categoryIds: ['cat-1'],
      });

      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc).toHaveBeenCalledWith('save_user_preferences_atomic', {
        p_category_ids: ['cat-1'],
        p_gasto_min: 15,
        p_gasto_max: 45,
        p_movilidad_preferida: 'transporte_publico',
        p_actualizar_movilidad: true,
      });
      expect(response.error).toBeNull();
    });

    it('devuelve el error si la RPC falla, manteniendo el contrato sin fallback inseguro', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: 'EMPTY_CATEGORIES', code: '22023' },
      } as any);

      const response = await saveUserPreferences({
        userId: 'user-123',
        movilidadPreferida: null,
        gastoMin: null,
        gastoMax: null,
        categoryIds: [],
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('EMPTY_CATEGORIES');
    });
  });
});
