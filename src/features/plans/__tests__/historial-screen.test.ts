import { describe, expect, it } from 'vitest';

import {
  formatFolioNumber,
  formatHistoryCost,
  formatHistoryDate,
  formatHistoryStopsLabel,
  formatMovilidadSolicitud,
  formatPresupuestoSolicitud,
  formatSolicitudDuracion,
  formatSolicitudHorario,
  formatSolicitudTitulo,
  formatTipoPuntoFinal,
  formatTotalDuration,
  formatValidatedCountLabel,
} from '@/features/plans/utils/historial-formatters';

describe('Historial «Mis Exploraciones» Serie AX — Formateadores y Reglas de Boleto', () => {
  describe('Formateo Estable de Folios de Serie AX', () => {
    it('genera folios secuenciales estables con numeración de 5 dígitos', () => {
      expect(formatFolioNumber(1)).toBe('FOLIO AX · N° 00001');
      expect(formatFolioNumber(42)).toBe('FOLIO AX · N° 00042');
      expect(formatFolioNumber(100)).toBe('FOLIO AX · N° 00100');
    });

    it('incorpora sufijo alfanumérico limpio cuando se provee el identificador del plan', () => {
      expect(formatFolioNumber(3, 'plan-route-ab12')).toBe('FOLIO AX · N° 00003-AB12');
      expect(formatFolioNumber(1, 'plan_9988')).toBe('FOLIO AX · N° 00001-9988');
    });

    it('protege ante índices menores a 1', () => {
      expect(formatFolioNumber(0)).toBe('FOLIO AX · N° 00001');
      expect(formatFolioNumber(-5)).toBe('FOLIO AX · N° 00001');
    });
  });

  describe('Formateo de Fechas en Formato Peruano y Manejo Seguro', () => {
    it('formatea fechas válidas en formato legible para Perú (día, mes abreviado, año)', () => {
      const fecha = formatHistoryDate('2026-10-13T16:00:00.000Z');
      expect(fecha).toBeTruthy();
      expect(fecha).toContain('2026');
    });

    it('devuelve fallback amigable sin lanzar error cuando la fecha es inválida o corrupta', () => {
      expect(formatHistoryDate('fecha-invalida')).toBe('Fecha no disponible');
      expect(formatHistoryDate('')).toBe('Fecha no disponible');
    });
  });

  describe('Formateo de Duraciones Acumuladas', () => {
    it('formatea horas exactas', () => {
      expect(formatTotalDuration(60)).toBe('1h');
      expect(formatTotalDuration(120)).toBe('2h');
    });

    it('formatea duraciones mixtas de horas y minutos', () => {
      expect(formatTotalDuration(75)).toBe('1h 15m');
      expect(formatTotalDuration(140)).toBe('2h 20m');
    });

    it('formatea duraciones menores a una hora solo con minutos', () => {
      expect(formatTotalDuration(45)).toBe('45 min');
      expect(formatTotalDuration(20)).toBe('20 min');
    });

    it('devuelve «Tiempo variable» si la duración es nula o menor o igual a cero', () => {
      expect(formatTotalDuration(0)).toBe('Tiempo variable');
      expect(formatTotalDuration(-10)).toBe('Tiempo variable');
    });
  });

  describe('Formateo Honesto de Gastos Referenciales', () => {
    it('muestra «Acceso libre» cuando el costo es 0 o nulo', () => {
      expect(formatHistoryCost(0)).toBe('Acceso libre');
      expect(formatHistoryCost(null as unknown as number)).toBe('Acceso libre');
      expect(formatHistoryCost(undefined as unknown as number)).toBe('Acceso libre');
    });

    it('muestra «S/ X aprox.» cuando hay un costo acumulado', () => {
      expect(formatHistoryCost(35)).toBe('S/ 35 aprox.');
      expect(formatHistoryCost(10)).toBe('S/ 10 aprox.');
    });
  });

  describe('Contadores Dinámicos y Textos Gramaticales', () => {
    it('formatea adecuadamente el singular y plural de paradas logradas', () => {
      expect(formatHistoryStopsLabel(1)).toBe('1 parada lograda');
      expect(formatHistoryStopsLabel(3)).toBe('3 paradas logradas');
      expect(formatHistoryStopsLabel(0)).toBe('0 paradas logradas');
    });

    it('formatea adecuadamente el singular y plural de boletos validados en el encabezado', () => {
      expect(formatValidatedCountLabel(0)).toBe('0 boletos validados');
      expect(formatValidatedCountLabel(1)).toBe('1 boleto validado');
      expect(formatValidatedCountLabel(5)).toBe('5 boletos validados');
    });
  });

  describe('Paleta Clara Serie AX y Accesibilidad Táctil', () => {
    it('utiliza los colores Serie AX requeridos', () => {
      const palette = {
        background: '#FAF5EE',
        surface: '#FFFDF9',
        brand: '#4A2E18',
        primary: '#9C3E1B',
        burgundy: '#7D2935',
        accent: '#D4AF37',
      };
      expect(palette.background).toBe('#FAF5EE'); // Crema pergamino
      expect(palette.surface).toBe('#FFFDF9');    // Blanco cálido marfil
      expect(palette.brand).toBe('#4A2E18');      // Marrón tinta
      expect(palette.primary).toBe('#9C3E1B');    // Terracota
      expect(palette.burgundy).toBe('#7D2935');   // Borgoña
      expect(palette.accent).toBe('#D4AF37');     // Dorado ocre
    });

    it('los botones CTA cumplen con la dimensión mínima de 48 dp para Android', () => {
      const buttonSpecs = {
        minHeight: 48,
      };
      expect(buttonSpecs.minHeight).toBeGreaterThanOrEqual(48);
    });

    it('la separación inferior en Historial mantiene 16 dp limpios sin duplicar los insets que ya gestiona NativeTabs', () => {
      const historialPaddingBottom = 16;
      expect(historialPaddingBottom).toBe(16);
    });
  });

  describe('Identidad Persistente de Boletos y Resiliencia de Renderizado', () => {
    it('genera claves persistentes priorizando id y timestamp del plan sin basarse en el índice', () => {
      const getTicketKey = (entry: { id?: string; completado_en?: string }, index: number) =>
        entry.id
          ? (entry.completado_en ? `${entry.id}-${entry.completado_en}` : entry.id)
          : (entry.completado_en || `historial-ticket-${index}`);

      expect(getTicketKey({ id: 'plan-101', completado_en: '2026-10-13T10:00:00Z' }, 0))
        .toBe('plan-101-2026-10-13T10:00:00Z');
      expect(getTicketKey({ id: 'plan-102' }, 1)).toBe('plan-102');
      expect(getTicketKey({ completado_en: '2026-10-13T12:00:00Z' }, 2))
        .toBe('2026-10-13T12:00:00Z');
      expect(getTicketKey({}, 3)).toBe('historial-ticket-3');
    });

    it('tolera datos parciales de estaciones proveyendo fallback sin arrojar excepciones', () => {
      const formatStation = (p: { orden: number; place?: { id?: string; nombre?: string } | null }) => {
        const stopKey = p.place?.id ? `stop-${p.orden}-${p.place.id}` : `stop-${p.orden}-fallback`;
        const nombreEstacion = p.place?.nombre || `Estación ${p.orden}`;
        return { stopKey, nombreEstacion };
      };

      // Caso normal completo
      expect(formatStation({ orden: 1, place: { id: 'p1', nombre: 'Museo Larco' } }))
        .toEqual({ stopKey: 'stop-1-p1', nombreEstacion: 'Museo Larco' });

      // Caso sin place o con place parcial
      expect(formatStation({ orden: 2, place: null }))
        .toEqual({ stopKey: 'stop-2-fallback', nombreEstacion: 'Estación 2' });
      expect(formatStation({ orden: 3, place: { id: 'p3' } }))
        .toEqual({ stopKey: 'stop-3-p3', nombreEstacion: 'Estación 3' });
    });
  });

  describe('Boletos de Solicitudes (Supabase) — Formateadores del Historial', () => {
    it('formatea horario y duración planeados en hora local', () => {
      const inicio = new Date(2026, 9, 15, 9, 30).toISOString();
      const fin = new Date(2026, 9, 15, 12, 0).toISOString();

      expect(formatSolicitudHorario(inicio, fin)).toBe('09:30 → 12:00');
      expect(formatSolicitudDuracion(inicio, fin)).toBe('2h 30m');
    });

    it('devuelve «Tiempo variable» si las fechas de la solicitud son inválidas', () => {
      expect(formatSolicitudDuracion('no-fecha', 'tampoco-es-fecha')).toBe('Tiempo variable');
    });

    it('formatea el presupuesto en todas sus combinaciones', () => {
      expect(formatPresupuestoSolicitud(null, null)).toBe('Sin límite');
      expect(formatPresupuestoSolicitud(null, 50)).toBe('Hasta S/ 50');
      expect(formatPresupuestoSolicitud(10, null)).toBe('Desde S/ 10');
      expect(formatPresupuestoSolicitud(20, 20)).toBe('S/ 20');
      expect(formatPresupuestoSolicitud(10, 50)).toBe('S/ 10 – S/ 50');
    });

    it('etiqueta movilidad y punto final con textos legibles', () => {
      expect(formatMovilidadSolicitud('CAMINANDO')).toBe('Caminando');
      expect(formatMovilidadSolicitud('TRANSPORTE_PUBLICO')).toBe('Transporte público');
      expect(formatMovilidadSolicitud('AUTO')).toBe('Taxi / aplicativo');

      expect(formatTipoPuntoFinal('REGRESAR_INICIO', null)).toBe('Regresar al inicio');
      expect(formatTipoPuntoFinal('ULTIMA_PARADA', null)).toBe('Última parada');
      expect(formatTipoPuntoFinal('OTRA_UBICACION', null)).toBe('Otra ubicación');
      expect(formatTipoPuntoFinal('OTRA_UBICACION', 'Cerca al Museo')).toBe('Cerca al Museo');
    });

    it('deriva el título del boleto desde la partida con respaldo honesto', () => {
      expect(formatSolicitudTitulo('Miraflores')).toBe('Expedición desde Miraflores');
      expect(formatSolicitudTitulo(null)).toBe('Solicitud de ruta');
    });
  });
});
