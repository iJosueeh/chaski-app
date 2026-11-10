import { describe, expect, it } from 'vitest';

import {
  formatNearbyStopMessage,
  nextTimeToday,
  reminderDateFor,
  STOP_REMINDER_MINUTES_BEFORE,
} from '../utils/plan-reminders';

const AHORA = new Date('2026-11-10T15:00:00');

describe('plan-reminders — nextTimeToday', () => {
  it('devuelve la hora de hoy cuando todavia no paso', () => {
    const resultado = nextTimeToday('18:30', AHORA);
    expect(resultado).not.toBeNull();
    expect(resultado!.getHours()).toBe(18);
    expect(resultado!.getMinutes()).toBe(30);
    expect(resultado!.getDate()).toBe(AHORA.getDate());
  });

  it('pasa al dia siguiente cuando la hora ya paso', () => {
    const resultado = nextTimeToday('09:15', AHORA);
    expect(resultado).not.toBeNull();
    expect(resultado!.getDate()).toBe(AHORA.getDate() + 1);
    expect(resultado!.getHours()).toBe(9);
  });

  it('rechaza textos que no son una hora', () => {
    expect(nextTimeToday('', AHORA)).toBeNull();
    expect(nextTimeToday('mediodia', AHORA)).toBeNull();
    expect(nextTimeToday('18-30', AHORA)).toBeNull();
  });

  it('rechaza horas fuera de rango', () => {
    expect(nextTimeToday('25:00', AHORA)).toBeNull();
    expect(nextTimeToday('10:75', AHORA)).toBeNull();
  });
});

describe('plan-reminders — reminderDateFor', () => {
  it('adelanta el aviso los minutos configurados', () => {
    const recordatorio = reminderDateFor('18:30', AHORA);
    expect(recordatorio).not.toBeNull();
    expect(recordatorio!.getHours()).toBe(18);
    expect(recordatorio!.getMinutes()).toBe(30 - STOP_REMINDER_MINUTES_BEFORE);
  });

  it('no programa un aviso que ya venció', () => {
    expect(reminderDateFor('15:05', AHORA)).toBeNull();
  });

  it('devuelve null si la hora de llegada no es valida', () => {
    expect(reminderDateFor('sin hora', AHORA)).toBeNull();
  });
});

describe('plan-reminders — formatNearbyStopMessage', () => {
  it('redondea los metros a la decena', () => {
    expect(formatNearbyStopMessage('Huaca Pucllana', 84)).toContain('80 m');
    expect(formatNearbyStopMessage('Huaca Pucllana', 86)).toContain('90 m');
  });

  it('nunca muestra cero metros', () => {
    expect(formatNearbyStopMessage('Huaca Pucllana', 2)).toContain('10 m');
  });
});
