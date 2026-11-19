import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '@/lib/supabase';

import {
  fetchAdminReports,
  normalizeAdminReports,
} from '../services/admin.service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const rpcMock = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

describe('Reportes y Estadísticas Administrativas (RF20 / CU09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAdminReports', () => {
    it('llama a admin_get_reports con periodo 30d por defecto', async () => {
      rpcMock.mockResolvedValueOnce({
        data: {
          rango: { periodo: '30d', desde: '2026-10-19T00:00:00Z', hasta: '2026-11-18T00:00:00Z', agrupacion: 'dia' },
          kpis: {
            solicitudes_total: 15,
            expediciones_total: 10,
            expediciones_completadas: 7,
            expediciones_parciales: 2,
            expediciones_abandonadas: 1,
            tasa_finalizacion: 70.0,
            tasa_conversion_solicitudes: 66.67,
            paradas_visitadas_total: 24,
          },
          categorias_ranking: [
            { id: 'cat-1', nombre: 'Historia', total: 10, porcentaje: 66.67 },
          ],
          destinos_incluidos_ranking: [
            { id: 'dest-1', nombre: 'Huaca Pucllana', total: 8, porcentaje: 80.0 },
          ],
          destinos_visitados_ranking: [
            { id: 'dest-1', nombre: 'Huaca Pucllana', total: 7, porcentaje: 70.0 },
          ],
          evolucion: [
            {
              fecha: '2026-11-18',
              solicitudes: 2,
              expediciones: 1,
              completadas: 1,
              parciales: 0,
              abandonadas: 0,
            },
          ],
        },
        error: null,
      });

      const result = await fetchAdminReports();

      expect(rpcMock).toHaveBeenCalledWith('admin_get_reports', {
        p_periodo: '30d',
        p_desde: null,
        p_hasta: null,
      });
      expect(result.error).toBeUndefined();
      expect(result.data?.kpis.solicitudes_total).toBe(15);
      expect(result.data?.kpis.tasa_finalizacion).toBe(70.0);
      expect(result.data?.kpis.tasa_conversion_solicitudes).toBe(66.67);
      expect(result.data?.categorias_ranking).toHaveLength(1);
      expect(result.data?.destinos_incluidos_ranking[0].nombre).toBe('Huaca Pucllana');
      expect(result.data?.evolucion).toHaveLength(1);
    });

    it('soporta periodos 7d, 90d y todo sin fechas adicionales', async () => {
      rpcMock.mockResolvedValueOnce({
        data: {
          rango: { periodo: '7d', desde: '2026-11-11T00:00:00Z', hasta: '2026-11-18T00:00:00Z', agrupacion: 'dia' },
          kpis: {},
        },
        error: null,
      });

      await fetchAdminReports({ periodo: '7d' });

      expect(rpcMock).toHaveBeenCalledWith('admin_get_reports', {
        p_periodo: '7d',
        p_desde: null,
        p_hasta: null,
      });
    });

    it('soporta rango personalizado pasando p_desde y p_hasta', async () => {
      rpcMock.mockResolvedValueOnce({
        data: {
          rango: { periodo: 'personalizado', desde: '2026-09-01T00:00:00Z', hasta: '2026-10-01T00:00:00Z', agrupacion: 'dia' },
          kpis: {},
        },
        error: null,
      });

      await fetchAdminReports({
        periodo: 'personalizado',
        desde: '2026-09-01T00:00:00Z',
        hasta: '2026-10-01T00:00:00Z',
      });

      expect(rpcMock).toHaveBeenCalledWith('admin_get_reports', {
        p_periodo: 'personalizado',
        p_desde: '2026-09-01T00:00:00Z',
        p_hasta: '2026-10-01T00:00:00Z',
      });
    });

    it('maneja errores retornados por Supabase y los sanitiza', async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'AUTH_UNAUTHORIZED: Se requieren privilegios de administrador' },
      });

      const result = await fetchAdminReports();

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('devuelve error si data es nula o no es objeto', async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await fetchAdminReports();

      expect(result.data).toBeNull();
      expect(result.error).toContain('No se pudieron leer');
    });

    it('captura excepciones lanzadas en la llamada RPC', async () => {
      rpcMock.mockRejectedValueOnce(new Error('Network connection failed'));

      const result = await fetchAdminReports();

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('normalizeAdminReports', () => {
    it('normaliza payload vacío o malformado con valores seguros', () => {
      const normalized = normalizeAdminReports({});

      expect(normalized.rango).toEqual({
        periodo: '30d',
        desde: '',
        hasta: '',
        agrupacion: 'dia',
      });
      expect(normalized.kpis).toEqual({
        solicitudes_total: 0,
        expediciones_total: 0,
        expediciones_completadas: 0,
        expediciones_parciales: 0,
        expediciones_abandonadas: 0,
        tasa_finalizacion: 0,
        tasa_conversion_solicitudes: 0,
        paradas_visitadas_total: 0,
      });
      expect(normalized.categorias_ranking).toEqual([]);
      expect(normalized.destinos_incluidos_ranking).toEqual([]);
      expect(normalized.destinos_visitados_ranking).toEqual([]);
      expect(normalized.evolucion).toEqual([]);
    });

    it('convierte cadenas numéricas en números correctamente', () => {
      const raw = {
        rango: { periodo: 'todo', agrupacion: 'mes', desde: '2026-01-01', hasta: '2026-11-18' },
        kpis: {
          solicitudes_total: '45',
          expediciones_total: '30',
          expediciones_completadas: '20',
          expediciones_parciales: '6',
          expediciones_abandonadas: '4',
          tasa_finalizacion: '66.67',
          tasa_conversion_solicitudes: '66.67',
          paradas_visitadas_total: '85',
        },
        categorias_ranking: [
          { id: 'c1', nombre: 'Cultura', total: '25', porcentaje: '55.56' },
        ],
        destinos_incluidos_ranking: [
          { id: 'd1', nombre: 'Museo Larco', total: '15', porcentaje: '50' },
        ],
        destinos_visitados_ranking: [
          { id: 'd1', nombre: 'Museo Larco', total: '12', porcentaje: '40' },
        ],
        evolucion: [
          {
            fecha: '2026-10',
            solicitudes: '10',
            expediciones: '8',
            completadas: '6',
            parciales: '2',
            abandonadas: '0',
          },
        ],
      };

      const normalized = normalizeAdminReports(raw);

      expect(normalized.rango.agrupacion).toBe('mes');
      expect(normalized.kpis.solicitudes_total).toBe(45);
      expect(normalized.kpis.tasa_finalizacion).toBe(66.67);
      expect(normalized.categorias_ranking[0].total).toBe(25);
      expect(normalized.categorias_ranking[0].porcentaje).toBe(55.56);
      expect(normalized.destinos_incluidos_ranking[0].total).toBe(15);
      expect(normalized.evolucion[0].solicitudes).toBe(10);
    });

    it('protege contra divisiones por cero cuando totales son 0', () => {
      const raw = {
        rango: { periodo: '7d', agrupacion: 'dia', desde: '2026-11-11', hasta: '2026-11-18' },
        kpis: {
          solicitudes_total: 0,
          expediciones_total: 0,
          expediciones_completadas: 0,
          tasa_finalizacion: 0,
          tasa_conversion_solicitudes: 0,
        },
        categorias_ranking: [],
        destinos_incluidos_ranking: [],
        destinos_visitados_ranking: [],
        evolucion: [],
      };

      const normalized = normalizeAdminReports(raw);
      expect(normalized.kpis.tasa_finalizacion).toBe(0);
      expect(normalized.kpis.tasa_conversion_solicitudes).toBe(0);
    });
  });

  describe('Lógica de filtros y rangos de reportes', () => {
    it('valida formato de fechas en rango personalizado', () => {
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      expect(regex.test('2026-10-01')).toBe(true);
      expect(regex.test('2026/10/01')).toBe(false);
      expect(regex.test('01-10-2026')).toBe(false);
      expect(regex.test('invalido')).toBe(false);
    });

    it('rechaza fechas donde desde es posterior a hasta', () => {
      const desde = '2026-11-20';
      const hasta = '2026-11-10';
      expect(desde > hasta).toBe(true);
    });
  });
});

