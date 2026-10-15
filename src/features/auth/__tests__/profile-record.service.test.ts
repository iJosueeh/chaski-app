import { describe, expect, it, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { fetchUserProfileRecord } from '../services/profile-record.service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('profile-record.service - Consulta de perfil del usuario autenticado (Serie AX)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza consultas con userId vacío', async () => {
    const res = await fetchUserProfileRecord('');
    expect(res.data).toBeNull();
    expect(res.error).toBe('Identificador de usuario no proporcionado');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('obtiene el perfil institucional de un usuario existente', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'user-123',
        nombre: 'Túpac Amaru',
        rol: 'ADMIN',
        estado: true,
        fecha_registro: '2026-01-01T00:00:00Z',
      },
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    });

    const res = await fetchUserProfileRecord('user-123');

    expect(supabase.from).toHaveBeenCalledWith('usuarios');
    expect(mockSelect).toHaveBeenCalledWith('id, nombre, rol, estado, fecha_registro');
    expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
    expect(res.data).toEqual({
      id: 'user-123',
      nombre: 'Túpac Amaru',
      rol: 'ADMIN',
      estado: true,
      fecha_registro: '2026-01-01T00:00:00Z',
    });
    expect(res.error).toBeUndefined();
  });

  it('retorna data null si el usuario aún no existe en public.usuarios', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    });

    const res = await fetchUserProfileRecord('user-404');
    expect(res.data).toBeNull();
    expect(res.error).toBeUndefined();
  });

  it('detecta error de red e informa isNetworkError: true sin confundir con suspensión', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Network request failed' },
    });

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    });

    const res = await fetchUserProfileRecord('user-123');
    expect(res.data).toBeNull();
    expect(res.isNetworkError).toBe(true);
    expect(res.error).toBe('Error de conexión con el servidor. Verifica tu conexión a internet.');
  });

  it('maneja excepciones no controladas devolviendo error seguro', async () => {
    (supabase.from as any).mockImplementation(() => {
      throw new Error('Failed to fetch');
    });

    const res = await fetchUserProfileRecord('user-ex');
    expect(res.data).toBeNull();
    expect(res.isNetworkError).toBe(true);
    expect(res.error).toContain('Error de conexión');
  });
});
