import { describe, expect, it } from 'vitest';

import { formatMobilityLabel, formatPlanDateTime } from '../utils/admin-plan-formatters';

describe('admin/utils/admin-plan-formatters — formatMobilityLabel', () => {
  it('traduce las tres movilidades del wizard', () => {
    expect(formatMobilityLabel('CAMINANDO')).toBe('Caminando');
    expect(formatMobilityLabel('TRANSPORTE_PUBLICO')).toBe('Transporte público');
    expect(formatMobilityLabel('AUTO')).toBe('Aplicativo / auto');
  });

  it('devuelve el valor crudo cuando la movilidad es desconocida', () => {
    expect(formatMobilityLabel('BICICLETA')).toBe('BICICLETA');
  });

  it('devuelve cadena vacía para nulos o indefinidos', () => {
    expect(formatMobilityLabel(null)).toBe('');
    expect(formatMobilityLabel(undefined)).toBe('');
  });
});

describe('admin/utils/admin-plan-formatters — formatPlanDateTime', () => {
  it('devuelve "Sin fecha" para valores ausentes o inválidos', () => {
    expect(formatPlanDateTime(null)).toBe('Sin fecha');
    expect(formatPlanDateTime('')).toBe('Sin fecha');
    expect(formatPlanDateTime('no-es-fecha')).toBe('Sin fecha');
  });

  it('incluye día, mes y hora en el texto formateado', () => {
    const texto = formatPlanDateTime('2026-10-13T16:00:00.000Z');
    expect(texto).not.toBe('Sin fecha');
    expect(texto).toMatch(/\d{2}/);
    expect(texto).toMatch(/:/);
  });
});
