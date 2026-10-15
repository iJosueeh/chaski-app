import { describe, expect, it } from 'vitest';

import { formatDateShort } from '../format-date';

describe('shared/utils/format-date — formatDateShort (es-PE)', () => {
  it('formatea una fecha ISO válida en estilo peruano corto (día-mes-año)', () => {
    const fecha = formatDateShort('2026-10-13T16:00:00.000Z');
    expect(fecha).toContain('2026');
    expect(fecha).toContain('13');
    expect(fecha).not.toContain('Invalid');
  });

  it('usa el fallback para fechas inválidas o ausentes', () => {
    expect(formatDateShort('fecha-invalida', 'Fecha no disponible')).toBe('Fecha no disponible');
    expect(formatDateShort('', 'Fecha no disponible')).toBe('Fecha no disponible');
    expect(formatDateShort(null, 'Fecha no disponible')).toBe('Fecha no disponible');
    expect(formatDateShort(undefined, 'Fecha no disponible')).toBe('Fecha no disponible');
  });

  it('usa cadena vacía como fallback por defecto', () => {
    expect(formatDateShort('fecha-invalida')).toBe('');
  });
});
