/**
 * Identificadores unicos para nombres de archivo.
 *
 * React Native (Hermes) no expone `crypto` como objeto global, asi que hay que
 * mirar en `globalThis` antes de usarlo y tener un respaldo propio. Los nombres
 * de archivo no son un secreto de seguridad: lo unico que se necesita es que no
 * se repitan, por eso el respaldo con Math.random es suficiente.
 */

/** Genera un identificador con formato UUID v4. */
export function generateUuid(): string {
  const cripto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;

  if (cripto && typeof cripto.randomUUID === 'function') {
    return cripto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (caracter) => {
    const aleatorio = (Math.random() * 16) | 0;
    const valor = caracter === 'x' ? aleatorio : (aleatorio & 0x3) | 0x8;
    return valor.toString(16);
  });
}
