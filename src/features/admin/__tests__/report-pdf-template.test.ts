import { describe, expect, it } from 'vitest';

import type { AdminReportsResult } from '../interfaces/admin.interface';
import { generateReportHtml } from '../utils/report-pdf-template';

describe('Report PDF Template (Serie AX)', () => {
  const mockReports: AdminReportsResult = {
    rango: {
      periodo: '30d',
      desde: '2026-10-19T00:00:00Z',
      hasta: '2026-11-18T00:00:00Z',
      agrupacion: 'dia',
    },
    kpis: {
      solicitudes_total: 42,
      expediciones_total: 30,
      expediciones_completadas: 24,
      expediciones_parciales: 4,
      expediciones_abandonadas: 2,
      tasa_finalizacion: 80.0,
      tasa_conversion_solicitudes: 71.4,
      paradas_visitadas_total: 96,
    },
    categorias_ranking: [
      { id: 'cat-1', nombre: 'Arqueología & Templos', total: 18, porcentaje: 60.0 },
      { id: 'cat-2', nombre: 'Gastronomía Tradicional', total: 12, porcentaje: 40.0 },
    ],
    destinos_incluidos_ranking: [
      { id: 'dest-1', nombre: 'Huaca Pucllana', total: 15, porcentaje: 50.0 },
    ],
    destinos_visitados_ranking: [
      { id: 'dest-1', nombre: 'Huaca Pucllana', total: 14, porcentaje: 46.7 },
      { id: 'dest-2', nombre: 'Barranco Histórico', total: 10, porcentaje: 33.3 },
    ],
    evolucion: [
      {
        fecha: '2026-11-17',
        solicitudes: 3,
        expediciones: 2,
        completadas: 2,
        parciales: 0,
        abandonadas: 0,
      },
      {
        fecha: '2026-11-18',
        solicitudes: 5,
        expediciones: 4,
        completadas: 3,
        parciales: 1,
        abandonadas: 0,
      },
    ],
  };

  it('genera un documento HTML bien estructurado con doctype y estilos', () => {
    const html = generateReportHtml(mockReports);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('CHASKI EXPEDICIONES');
    expect(html).toContain('SISTEMA DE GESTIÓN INSTITUCIONAL · SERIE AX');
  });

  it('incluye los KPIs principales formateados', () => {
    const html = generateReportHtml(mockReports);

    expect(html).toContain('42'); // solicitudes_total
    expect(html).toContain('30'); // expediciones_total
    expect(html).toContain('24'); // expediciones_completadas
    expect(html).toContain('80.0%'); // tasa_finalizacion
    expect(html).toContain('71.4%'); // tasa_conversion_solicitudes
    expect(html).toContain('96'); // paradas_visitadas_total
  });

  it('escapa caracteres especiales para prevenir XSS en rankings o títulos', () => {
    const dangerousReports: AdminReportsResult = {
      ...mockReports,
      categorias_ranking: [
        { id: 'x1', nombre: '<script>alert("xss")</script>', total: 5, porcentaje: 20 },
      ],
    };

    const html = generateReportHtml(dangerousReports, {
      titulo: 'Reporte <Malicioso> & "Cuidado"',
    });

    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).toContain('Reporte &lt;Malicioso&gt; &amp; &quot;Cuidado&quot;');
  });

  it('renderiza la tabla de evolución temporal con desglose y estado de efectividad', () => {
    const html = generateReportHtml(mockReports);

    expect(html).toContain('2026-11-17');
    expect(html).toContain('2026-11-18');
    expect(html).toContain('100.0%'); // Efectividad del día 17 (2/2)
    expect(html).toContain('75.0%');  // Efectividad del día 18 (3/4)
  });

  it('soporta opciones personalizadas de folio y fecha de emisión', () => {
    const html = generateReportHtml(mockReports, {
      folio: 'CHK-TEST-00042',
      fechaEmision: '19 nov 2026, 08:30:00',
    });

    expect(html).toContain('CHK-TEST-00042');
    expect(html).toContain('19 nov 2026, 08:30:00');
  });

  it('maneja listas vacías de rankings y evolución sin romperse', () => {
    const emptyReports: AdminReportsResult = {
      ...mockReports,
      categorias_ranking: [],
      destinos_visitados_ranking: [],
      evolucion: [],
    };

    const html = generateReportHtml(emptyReports);

    expect(html).toContain('Sin registros en este período');
    expect(html).toContain('No se registran datos para la escala temporal seleccionada.');
  });
});
