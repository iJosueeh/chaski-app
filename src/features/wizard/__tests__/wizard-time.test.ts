import { describe, expect, it } from 'vitest';

import {
  MINUTOS_POR_DIA,
  cruzaMedianoche,
  duracionEntreHoras,
  esIntervaloValido,
  minutoDelDia,
  minutosAHora,
  parseHoraAMinutos,
} from '../utils/wizard-time';

describe('Wizard Paso 2 «Tiempo disponible» — Reglas de Intervalo Serie AX', () => {
  describe('Horarios normales (mismo día)', () => {
    it('calcula la duración de un intervalo dentro del mismo día', () => {
      expect(duracionEntreHoras(9 * 60, 13 * 60)).toBe(240);
      expect(duracionEntreHoras(14 * 60 + 30, 18 * 60)).toBe(210);
      expect(duracionEntreHoras(9 * 60, 9 * 60 + 1)).toBe(1);
    });

    it('convierte «HH:MM» a minutos del día y de vuelta', () => {
      expect(parseHoraAMinutos('09:30')).toBe(570);
      expect(minutosAHora(570)).toBe('09:30');
      expect(minutosAHora(parseHoraAMinutos('23:59')!)).toBe('23:59');
      expect(minutosAHora(parseHoraAMinutos('00:00')!)).toBe('00:00');
    });

    it('rechaza cadenas de hora inválidas', () => {
      expect(parseHoraAMinutos(null)).toBeNull();
      expect(parseHoraAMinutos(undefined)).toBeNull();
      expect(parseHoraAMinutos('')).toBeNull();
      expect(parseHoraAMinutos('9:00:00')).toBeNull();
      expect(parseHoraAMinutos('24:00')).toBeNull();
      expect(parseHoraAMinutos('10:61')).toBeNull();
      expect(parseHoraAMinutos('abc')).toBeNull();
    });

    it('deriva los minutos del día desde una fecha, ignorando año, mes y día', () => {
      expect(minutoDelDia(new Date(2026, 0, 1, 22, 15))).toBe(22 * 60 + 15);
      expect(minutoDelDia(new Date(2030, 11, 31, 9, 5))).toBe(9 * 60 + 5);
    });
  });

  describe('Cruce de medianoche (hora límite al día siguiente)', () => {
    it('interpreta la hora límite como día siguiente cuando es anterior al inicio', () => {
      expect(duracionEntreHoras(22 * 60, 2 * 60)).toBe(240);
      expect(duracionEntreHoras(23 * 60 + 30, 15)).toBe(45);
      expect(duracionEntreHoras(18 * 60, 6 * 60)).toBe(720);
    });

    it('marca el cruce solo cuando la hora límite es anterior a la de inicio', () => {
      expect(cruzaMedianoche(22 * 60, 2 * 60)).toBe(true);
      expect(cruzaMedianoche(9 * 60, 13 * 60)).toBe(false);
      expect(cruzaMedianoche(10 * 60, 10 * 60)).toBe(false);
    });

    it('los presets del wizard conservan su duración al cruzar medianoche', () => {
      const inicio2200 = parseHoraAMinutos('22:00')!;
      // 2 HORAS (120), 4 HORAS (240) y LA TARDE (360) aplicados a las 22:00
      for (const minutos of [120, 240, 360]) {
        const finCalculado = minutosAHora(inicio2200 + minutos);
        expect(duracionEntreHoras(inicio2200, parseHoraAMinutos(finCalculado)!)).toBe(minutos);
        expect(cruzaMedianoche(inicio2200, parseHoraAMinutos(finCalculado)!)).toBe(true);
      }
      expect(minutosAHora(22 * 60 + 120)).toBe('00:00');
    });

    it('el intervalo cruzado sigue siendo válido (CTA CONTINUAR habilitado)', () => {
      expect(esIntervaloValido(duracionEntreHoras(22 * 60, 2 * 60))).toBe(true);
    });

    it('el envío al contexto usa la misma duración que muestra la UI', () => {
      // Simula el CTA CONTINUAR con 22:00 → 02:00
      const inicioMin = parseHoraAMinutos('22:00')!;
      const finMin = parseHoraAMinutos('02:00')!;

      expect(duracionEntreHoras(inicioMin, finMin)).toBe(240);
      expect(minutosAHora(inicioMin)).toBe('22:00');
      expect(minutosAHora(finMin)).toBe('02:00');
      expect(cruzaMedianoche(inicioMin, finMin)).toBe(true);
    });
  });

  describe('Misma hora (límite existente)', () => {
    it('produce 0 minutos e invalida el intervalo', () => {
      const duracion = duracionEntreHoras(10 * 60, 10 * 60);
      expect(duracion).toBe(0);
      expect(esIntervaloValido(duracion)).toBe(false);
    });

    it('no se interpreta como cruce de medianoche', () => {
      expect(cruzaMedianoche(10 * 60, 10 * 60)).toBe(false);
    });

    it('00:00 → 00:00 también queda inválido (misma hora, sin duración)', () => {
      const duracion = duracionEntreHoras(0, 0);
      expect(duracion).toBe(0);
      expect(esIntervaloValido(duracion)).toBe(false);
    });
  });

  describe('Límites de duración', () => {
    it('la duración mínima válida sigue siendo 1 minuto', () => {
      expect(esIntervaloValido(1)).toBe(true);
      expect(esIntervaloValido(0)).toBe(false);
    });

    it('la duración nunca alcanza 24 h por la interpretación de un solo día siguiente', () => {
      // 23:59 → 23:58 = 1439 minutos, el máximo posible
      const maximo = duracionEntreHoras(23 * 60 + 59, 23 * 60 + 58);
      expect(maximo).toBe(MINUTOS_POR_DIA - 1);
      expect(esIntervaloValido(maximo)).toBe(true);
    });

    it('rechaza duraciones no finitas', () => {
      expect(esIntervaloValido(Number.NaN)).toBe(false);
      expect(esIntervaloValido(Number.POSITIVE_INFINITY)).toBe(false);
    });

    it('normaliza con aritmética modular los minutos fuera de rango', () => {
      expect(minutosAHora(24 * 60)).toBe('00:00');
      expect(minutosAHora(-60)).toBe('23:00');
      expect(minutosAHora(14 * 60 + 65)).toBe('15:05');
    });
  });
});
