import { describe, expect, it } from 'vitest';

import { createLatestRequestGuard } from '../latest-request';

describe('shared/utils/latest-request — guard de última petición', () => {
  it('solo la petición más reciente sigue vigente', () => {
    const guard = createLatestRequestGuard();

    const first = guard.next();
    expect(guard.isCurrent(first)).toBe(true);

    const second = guard.next();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it('invalidate descarta cualquier petición en vuelo (cambio de id o desmontaje)', () => {
    const guard = createLatestRequestGuard();

    const inFlight = guard.next();
    guard.invalidate();

    expect(guard.isCurrent(inFlight)).toBe(false);
  });

  it('nunca reutiliza ids tras invalidar (doble cambio de id sin colisión)', () => {
    const guard = createLatestRequestGuard();

    // Ciclo 1: petición en vuelo que tarda.
    const cycleOne = guard.next();

    // Cambio de id: se invalida y arranca el ciclo 2.
    guard.invalidate();
    const cycleTwo = guard.next();
    expect(cycleTwo).not.toBe(cycleOne);

    // Segundo cambio de id: el id del ciclo 2 no puede colisionar con el 3.
    guard.invalidate();
    const cycleThree = guard.next();
    expect(cycleThree).not.toBe(cycleTwo);
    expect(guard.isCurrent(cycleOne)).toBe(false);
    expect(guard.isCurrent(cycleTwo)).toBe(false);
    expect(guard.isCurrent(cycleThree)).toBe(true);
  });
});
