import { describe, expect, it } from 'vitest';

import { MINUTES_PER_DAY, minutesToTime, parseTimeToMinutes } from '../time';

describe('shared/utils/time — parser y formateador «HH:MM»', () => {
  describe('parseTimeToMinutes', () => {
    it('convierte horas válidas a minutos del día', () => {
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('09:30')).toBe(570);
      expect(parseTimeToMinutes('23:59')).toBe(1439);
    });

    it('acepta horas no rellenadas con cero (tolerancia heredada del parser del wizard)', () => {
      expect(parseTimeToMinutes('7:5')).toBe(425);
      expect(parseTimeToMinutes('9:00')).toBe(540);
    });

    it('devuelve null ante entradas ausentes o malformadas', () => {
      expect(parseTimeToMinutes(null)).toBeNull();
      expect(parseTimeToMinutes(undefined)).toBeNull();
      expect(parseTimeToMinutes('')).toBeNull();
      expect(parseTimeToMinutes('08')).toBeNull();
      expect(parseTimeToMinutes('08:30:15')).toBeNull();
      expect(parseTimeToMinutes('noon')).toBeNull();
      expect(parseTimeToMinutes('08:3a')).toBeNull();
    });

    it('devuelve null fuera del rango 0–23 h / 0–59 min', () => {
      expect(parseTimeToMinutes('24:00')).toBeNull();
      expect(parseTimeToMinutes('10:60')).toBeNull();
      expect(parseTimeToMinutes('-1:00')).toBeNull();
    });
  });

  describe('minutesToTime', () => {
    it('rellena con cero a dos dígitos', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(450)).toBe('07:30');
      expect(minutesToTime(1439)).toBe('23:59');
    });

    it('normaliza con aritmética modular los minutos fuera de rango', () => {
      expect(minutesToTime(MINUTES_PER_DAY)).toBe('00:00');
      expect(minutesToTime(1447)).toBe('00:07');
      expect(minutesToTime(-60)).toBe('23:00');
      expect(minutesToTime(2880)).toBe('00:00');
    });

    it('redondea minutos fraccionarios', () => {
      expect(minutesToTime(61.4)).toBe('01:01');
      expect(minutesToTime(61.6)).toBe('01:02');
    });

    it('roundtrip con parseTimeToMinutes en los extremos del día', () => {
      expect(minutesToTime(parseTimeToMinutes('23:59')!)).toBe('23:59');
      expect(parseTimeToMinutes(minutesToTime(570))).toBe(570);
    });
  });
});
