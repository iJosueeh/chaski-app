import { describe, expect, it } from 'vitest';

import {
  formatPlaceBudget,
  formatPlaceDuration,
  formatPlaceFolio,
  getPlaceCategoryNames,
  getPlacePhotoAlt,
  getPlacePrimaryCategory,
} from '../utils/places-formatters';

describe('PlacesFormatters — Etiquetas de Boleto Serie AX', () => {
  describe('Presupuesto del destino', () => {
    it('marca como gratis cuando no hay rango registrado', () => {
      expect(formatPlaceBudget(null, null)).toEqual({ label: 'Entrada gratis', isFree: true });
      expect(formatPlaceBudget(0, 0)).toEqual({ label: 'Entrada gratis', isFree: true });
      expect(formatPlaceBudget(undefined, undefined)).toEqual({
        label: 'Entrada gratis',
        isFree: true,
      });
    });

    it('combina mínimo y máximo en una sola etiqueta compacta', () => {
      expect(formatPlaceBudget(15, 30)).toEqual({ label: 'S/ 15 — S/ 30', isFree: false });
    });

    it('soporta rangos abiertos por arriba o por abajo', () => {
      expect(formatPlaceBudget(10, null)).toEqual({ label: 'Desde S/ 10', isFree: false });
      expect(formatPlaceBudget(null, 40)).toEqual({ label: 'Hasta S/ 40', isFree: false });
      expect(formatPlaceBudget(0, 20)).toEqual({ label: 'Gratis · hasta S/ 20', isFree: true });
    });

    it('ignora valores negativos como si no existieran', () => {
      expect(formatPlaceBudget(-5, -1)).toEqual({ label: 'Entrada gratis', isFree: true });
    });
  });

  describe('Duración sugerida', () => {
    it('formatea minutos, horas exactas y combinaciones', () => {
      expect(formatPlaceDuration(45)).toBe('45 min');
      expect(formatPlaceDuration(120)).toBe('2 h');
      expect(formatPlaceDuration(90)).toBe('1 h 30 min');
      expect(formatPlaceDuration(60)).toBe('1 h');
    });

    it('devuelve null cuando no hay duración utilizable', () => {
      expect(formatPlaceDuration(null)).toBeNull();
      expect(formatPlaceDuration(undefined)).toBeNull();
      expect(formatPlaceDuration(0)).toBeNull();
      expect(formatPlaceDuration(-30)).toBeNull();
    });
  });

  describe('Folio estable de serie', () => {
    it('genera siempre el mismo folio de 5 dígitos para el mismo destino', () => {
      const first = formatPlaceFolio('lugar-1');
      const second = formatPlaceFolio('lugar-1');

      expect(first).toBe(second);
      expect(first).toBe('AX-83795');
      expect(first).toMatch(/^AX-\d{5}$/);
    });

    it('asigna folios distintos a destinos distintos', () => {
      const folios = [
        formatPlaceFolio('lugar-1'),
        formatPlaceFolio('lugar-2'),
        formatPlaceFolio('sucursal-miraflores'),
        formatPlaceFolio('sucursal-barranco'),
      ];

      expect(new Set(folios).size).toBe(folios.length);
    });

    it('es tolerante a identificadores ausentes', () => {
      expect(formatPlaceFolio(null)).toBe('AX-10000');
      expect(formatPlaceFolio(undefined)).toBe('AX-10000');
    });
  });

  describe('Categorías y etiquetas visuales', () => {
    it('toma la primera categoría con respaldo PATRIMONIO', () => {
      expect(getPlacePrimaryCategory([{ nombre: 'Cultura' }, { nombre: 'Gastronomía' }])).toBe(
        'Cultura',
      );
      expect(getPlacePrimaryCategory([])).toBe('PATRIMONIO');
      expect(getPlacePrimaryCategory(null)).toBe('PATRIMONIO');
      expect(getPlacePrimaryCategory([{ nombre: '   ' }], 'SIN CATEGORÍA')).toBe('SIN CATEGORÍA');
    });

    it('limita las chips de la tarjeta y descarta nombres vacíos', () => {
      const categorias = [
        { nombre: 'Cultura' },
        { nombre: '' },
        { nombre: 'Gastronomía' },
        { nombre: 'Museos' },
        { nombre: 'Historia' },
      ];

      expect(getPlaceCategoryNames(categorias, 3)).toEqual(['Cultura', 'Gastronomía', 'Museos']);
      expect(getPlaceCategoryNames(categorias, 0)).toEqual([]);
      expect(getPlaceCategoryNames(null)).toEqual([]);
    });

    it('describe la fotografía de forma accesible y coherente', () => {
      expect(getPlacePhotoAlt('Huaca Pucllana')).toBe('Fotografía de Huaca Pucllana');
      expect(getPlacePhotoAlt('  ')).toBe('Fotografía del destino');
      expect(getPlacePhotoAlt(null)).toBe('Fotografía del destino');
    });
  });
});
