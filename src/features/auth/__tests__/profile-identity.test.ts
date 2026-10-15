import { describe, expect, it, vi } from 'vitest';
import {
  formatMembershipDate,
  validateProfileName,
} from '../utils/profile-validation';
import { updateProfile } from '../services/auth.service';
import { supabase } from '@/lib/supabase';

vi.mock('expo-linking', () => ({
  createURL: vi.fn((path: string) => `chaski://${path.replace(/^\//, '')}`),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
    },
  },
}));

describe('Validaciones de Identidad del Explorador (profile-validation)', () => {
  describe('validateProfileName', () => {
    it('aprueba nombres válidos y recorta espacios exteriores', () => {
      const res1 = validateProfileName('Túpac Yupanqui');
      expect(res1.isValid).toBe(true);
      expect(res1.trimmedName).toBe('Túpac Yupanqui');
      expect(res1.error).toBeUndefined();

      const res2 = validateProfileName('   Mama Ocllo   ');
      expect(res2.isValid).toBe(true);
      expect(res2.trimmedName).toBe('Mama Ocllo');
    });

    it('aprueba nombres cortos válidos de al menos 2 caracteres', () => {
      const res = validateProfileName('Jo');
      expect(res.isValid).toBe(true);
      expect(res.trimmedName).toBe('Jo');
    });

    it('rechaza nombres vacíos o formados sólo por espacios en blanco', () => {
      const r1 = validateProfileName('');
      expect(r1.isValid).toBe(false);
      expect(r1.error).toBe('Ingresa tu nombre completo');

      const r2 = validateProfileName('     ');
      expect(r2.isValid).toBe(false);
      expect(r2.error).toBe('Ingresa tu nombre completo');
    });

    it('rechaza nombres con menos de 2 caracteres', () => {
      const res = validateProfileName('A');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('El nombre debe tener al menos 2 caracteres');

      const resWithSpaces = validateProfileName('  B  ');
      expect(resWithSpaces.isValid).toBe(false);
      expect(resWithSpaces.error).toBe('El nombre debe tener al menos 2 caracteres');
    });

    it('rechaza nombres que superan los 60 caracteres', () => {
      const longName = 'A'.repeat(61);
      const res = validateProfileName(longName);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('El nombre no puede exceder 60 caracteres');
    });

    it('aprueba nombres exactos de 60 caracteres', () => {
      const exactName = 'A'.repeat(60);
      const res = validateProfileName(exactName);
      expect(res.isValid).toBe(true);
      expect(res.trimmedName).toBe(exactName);
    });
  });

  describe('formatMembershipDate', () => {
    it('formatea correctamente fechas ISO válidas en español', () => {
      // 2026-10-11T16:30:00.000Z
      const formatted = formatMembershipDate('2026-10-11T12:00:00.000Z');
      expect(formatted).toMatch(/11 de octubre de 2026/);
    });

    it('formatea fechas de otros meses correctamente', () => {
      const formatted = formatMembershipDate('2025-01-05T08:00:00.000Z');
      expect(formatted).toMatch(/5 de enero de 2025/);
    });

    it('devuelve mensaje de respaldo para null, undefined o strings vacíos', () => {
      expect(formatMembershipDate(null)).toBe('Fecha no disponible');
      expect(formatMembershipDate(undefined)).toBe('Fecha no disponible');
      expect(formatMembershipDate('')).toBe('Fecha no disponible');
    });

    it('devuelve mensaje de respaldo para strings con fecha inválida', () => {
      expect(formatMembershipDate('fecha-invalida')).toBe('Fecha no disponible');
    });
  });
});

describe('Servicio de Actualización de Perfil (auth.service)', () => {
  it('invoca supabase.auth.updateUser con el payload correcto { data: { nombre } }', async () => {
    const mockUser = {
      id: 'usr-123',
      email: 'explorador@chaski.pe',
      user_metadata: { nombre: 'Garcilaso de la Vega' },
    };

    vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
      data: { user: mockUser as any },
      error: null,
    });

    const result = await updateProfile({ nombre: 'Garcilaso de la Vega' });

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: {
        nombre: 'Garcilaso de la Vega',
      },
    });

    expect(result.data?.user?.user_metadata?.nombre).toBe('Garcilaso de la Vega');
    expect(result.error).toBeNull();
  });

  it('propaga errores devueltos por Supabase Auth al intentar actualizar', async () => {
    const mockError = {
      name: 'AuthError',
      message: 'Error de conexión con el servidor',
    };

    vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
      data: { user: null },
      error: mockError as any,
    });

    const result = await updateProfile({ nombre: 'Nombre Fallido' });

    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('Error de conexión con el servidor');
  });
});
