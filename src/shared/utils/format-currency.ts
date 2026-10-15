/**
 * Formateadores puros de moneda/presupuesto compartidos (Serie AX).
 *
 * Cada pantalla de la app muestra el presupuesto con su propio copy y sus
 * propias reglas de guardado; aquí vive únicamente el formateador puro del
 * rango de presupuesto del Home, extraído para poder probarlo directamente.
 *
 * Convención de importes: soles peruanos «S/ {n}» sin decimales.
 */

/**
 * Formatea el rango de presupuesto del usuario en el Home («Boleto de
 * Experiencias»).
 *
 * Reglas (idénticas a las que históricamente vivían en `(tabs)/index.tsx`):
 * - min y max presentes → «S/ {min} — S/ {max}»
 * - solo min            → «Desde S/ {min}»
 * - solo max            → «Hasta S/ {max}»
 * - ninguno             → «Presupuesto abierto»
 */
export function formatBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min != null && max != null) {
    return `S/ ${min} — S/ ${max}`;
  }
  if (min != null) {
    return `Desde S/ ${min}`;
  }
  if (max != null) {
    return `Hasta S/ ${max}`;
  }
  return 'Presupuesto abierto';
}
