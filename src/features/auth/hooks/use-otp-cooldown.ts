/**
 * `useOtpCooldown` — temporizador de enfriamiento para el reenvío de códigos OTP.
 *
 * Extraído de la pantalla de verificación: cuenta regresiva de 60 s (rate limits
 * de Supabase) con intervalo de 1 s. El intervalo se recrea en cada tick —misma
 * semántica histórica— y se limpia siempre al desmontar o al llegar a 0.
 */
import { useCallback, useEffect, useState } from 'react';

/** Segundos de enfriamiento antes de permitir reenviar un código OTP. */
export const OTP_COOLDOWN_SECONDS = 60;

/**
 * Siguiente valor del contador: decrementa hasta 0 y se estanca ahí.
 * Es la lógica pura del tick, extraída para poder probarla directamente.
 */
export function tickCooldown(prev: number): number {
  return prev > 0 ? prev - 1 : 0;
}

/**
 * Cooldown de reenvío. `restart()` vuelve a los 60 s tras un reenvío exitoso.
 */
export function useOtpCooldown(initialSeconds: number = OTP_COOLDOWN_SECONDS) {
  const [cooldown, setCooldown] = useState(initialSeconds);

  // Temporizador para el cooldown de reenvío (60 segundos)
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(tickCooldown);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const restart = useCallback((seconds: number = OTP_COOLDOWN_SECONDS) => {
    setCooldown(seconds);
  }, []);

  return { cooldown, restart };
}
