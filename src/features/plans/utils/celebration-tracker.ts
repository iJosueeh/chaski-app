/**
 * Control de ciclo de vida de la celebración de expedición completada.
 *
 * Garantiza que la celebración de confeti se reproduzca únicamente una vez
 * al finalizar realmente un recorrido y no se repita en:
 * - Re-renderizados del componente.
 * - Navegación hacia atrás desde Historial o Inicio.
 * - Re-apertura de planes históricos archivados hace más de 5 minutos.
 */

const celebratedEntries = new Set<string>();

/**
 * Determina si la celebración debe reproducirse para una expedición dada.
 */
export function shouldTriggerCelebration(
  planId?: string | null,
  completedAtIso?: string | null,
  nowMs: number = Date.now(),
  estadoExpedicion?: string | null
): boolean {
  if (!planId) return false;
  // Solo se celebra con confeti si la expedición fue 100% COMPLETADA
  if (estadoExpedicion && estadoExpedicion !== 'COMPLETADA') {
    return false;
  }
  const key = `${planId}_${completedAtIso || ''}`;

  if (celebratedEntries.has(key)) {
    return false;
  }

  // Si el plan fue completado hace más de 5 minutos, se considera histórico (no recién finalizado)
  if (completedAtIso) {
    const completedTime = new Date(completedAtIso).getTime();
    if (!Number.isNaN(completedTime)) {
      const elapsedMs = nowMs - completedTime;
      if (elapsedMs > 5 * 60 * 1000) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Registra que la expedición ya fue celebrada para evitar repeticiones.
 */
export function markCelebrationAsTriggered(
  planId?: string | null,
  completedAtIso?: string | null
): void {
  if (!planId) return;
  const key = `${planId}_${completedAtIso || ''}`;
  celebratedEntries.add(key);
}

/**
 * Reinicia el registro (utilizado exclusivamente en pruebas automatizadas).
 */
export function resetCelebrationTrackerForTest(): void {
  celebratedEntries.clear();
}
