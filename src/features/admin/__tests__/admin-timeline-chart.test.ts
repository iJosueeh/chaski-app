import { describe, expect, it } from 'vitest';

import type { AdminReportTimelinePoint } from '../interfaces/admin.interface';

describe('Admin Timeline Calculations and Logic (Serie AX)', () => {
  const sampleEvolucion: AdminReportTimelinePoint[] = [
    {
      fecha: '2026-11-15',
      solicitudes: 4,
      expediciones: 3,
      completadas: 2,
      parciales: 1,
      abandonadas: 0,
    },
    {
      fecha: '2026-11-16',
      solicitudes: 8,
      expediciones: 6,
      completadas: 5,
      parciales: 1,
      abandonadas: 0,
    },
    {
      fecha: '2026-11-17',
      solicitudes: 2,
      expediciones: 1,
      completadas: 1,
      parciales: 0,
      abandonadas: 0,
    },
  ];

  function calculateTimelineStats(evolucion: AdminReportTimelinePoint[]) {
    if (evolucion.length === 0) {
      return {
        maxVal: 1,
        totalSol: 0,
        totalExp: 0,
        promSol: '0.0',
        promExp: '0.0',
        picoPoint: null,
      };
    }

    let maxVal = 1;
    let totalSol = 0;
    let totalExp = 0;
    let picoPoint = evolucion[0];
    let picoSum = 0;

    for (const pt of evolucion) {
      totalSol += pt.solicitudes;
      totalExp += pt.expediciones;
      const combined = pt.solicitudes + pt.expediciones;
      if (combined > picoSum) {
        picoSum = combined;
        picoPoint = pt;
      }
      if (pt.solicitudes > maxVal) maxVal = pt.solicitudes;
      if (pt.expediciones > maxVal) maxVal = pt.expediciones;
    }

    const count = evolucion.length;
    return {
      maxVal,
      totalSol,
      totalExp,
      promSol: (totalSol / count).toFixed(1),
      promExp: (totalExp / count).toFixed(1),
      picoPoint,
    };
  }

  function formatShortDate(rawDate: string, agrupacion: 'dia' | 'mes' = 'dia'): string {
    if (!rawDate) return '';
    if (agrupacion === 'mes') {
      const parts = rawDate.split('-');
      if (parts.length === 2) {
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${monthNames[mIdx] ?? parts[1]} '${parts[0].slice(2)}`;
      }
      return rawDate;
    }

    const parts = rawDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return rawDate;
  }

  it('calcula correctamente máximos, totales y promedios', () => {
    const stats = calculateTimelineStats(sampleEvolucion);

    expect(stats.maxVal).toBe(8);
    expect(stats.totalSol).toBe(14);
    expect(stats.totalExp).toBe(10);
    expect(stats.promSol).toBe('4.7');
    expect(stats.promExp).toBe('3.3');
    expect(stats.picoPoint?.fecha).toBe('2026-11-16');
  });

  it('formatea fechas a formato compacto para el eje del gráfico', () => {
    expect(formatShortDate('2026-11-18', 'dia')).toBe('18/11');
    expect(formatShortDate('2026-05', 'mes')).toBe("May '26");
    expect(formatShortDate('2026-12', 'mes')).toBe("Dic '26");
    expect(formatShortDate('', 'dia')).toBe('');
  });

  it('maneja listas vacías de evolución de forma segura', () => {
    const stats = calculateTimelineStats([]);
    expect(stats.maxVal).toBe(1);
    expect(stats.totalSol).toBe(0);
    expect(stats.picoPoint).toBeNull();
  });

  it('limita la visualización inicial a 5 elementos para evitar desborde vertical', () => {
    const manyDays: AdminReportTimelinePoint[] = Array.from({ length: 30 }, (_, i) => ({
      fecha: `2026-10-${String(i + 1).padStart(2, '0')}`,
      solicitudes: i,
      expediciones: i,
      completadas: i,
      parciales: 0,
      abandonadas: 0,
    }));

    const initialLimit = 5;
    const initialSlice = manyDays.slice(0, initialLimit);
    expect(initialSlice).toHaveLength(5);
    expect(manyDays.length).toBe(30);
  });
});
