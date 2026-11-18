/**
 * Conversion de imagenes a bytes.
 *
 * Vive en shared porque la usan tanto el avatar del perfil como las fotos de
 * los destinos: es la misma operacion y no conviene tenerla dos veces.
 */

/** Convierte base64 (con o sin prefijo `data:`) en bytes binarios. */
export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Lee los bytes de una imagen local. Si ya viene en base64 se usa eso, que
 * evita una lectura extra del sistema de archivos.
 */
export async function readBinaryFromUri(
  localUri: string,
  base64?: string | null,
): Promise<Uint8Array> {
  if (base64) {
    return base64ToUint8Array(base64);
  }

  const response = await fetch(localUri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
