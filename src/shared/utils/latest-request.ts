/**
 * Guard de «última petición» compartido (Serie AX).
 *
 * Protege los hooks de datos frente a respuestas obsoletas: cada petición
 * obtiene un id incremental y solo se aplica si sigue siendo la más reciente.
 * `invalidate()` marca todo lo pendiente como obsoleta (cambio de id o
 * desmontaje) sin reutilizar ids, de modo que una respuesta lenta de un ciclo
 * anterior nunca puede colisionar con una del ciclo nuevo.
 */

export type LatestRequestGuard = {
  /** Reserva el turno de la siguiente petición y devuelve su id. */
  next: () => number;
  /** true si la petición sigue siendo la más reciente. */
  isCurrent: (requestId: number) => boolean;
  /** Marca cualquier petición en vuelo como obsoleta. */
  invalidate: () => void;
};

/** Crea un guard independiente por instancia de hook. */
export function createLatestRequestGuard(): LatestRequestGuard {
  let current = 0;
  return {
    next: () => ++current,
    isCurrent: (requestId: number) => requestId === current,
    invalidate: () => {
      current += 1;
    },
  };
}
