/**
 * Reglas de las imagenes de los destinos: formatos permitidos, tamano maximo,
 * rutas validas y revision de los bytes antes de subirlos.
 *
 * Este modulo no habla con Supabase a proposito, para poder probarlo sin red.
 */

export const PLACES_BUCKET = "places";
export const MAX_PLACE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_PLACE_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PlaceImageMimeType = (typeof ALLOWED_PLACE_IMAGE_MIMES)[number];

export interface PlaceImageFormatInfo {
  mime: PlaceImageMimeType;
  ext: "jpg" | "png" | "webp";
}

export function detectPlaceImageFormat(
  bytes: Uint8Array,
): PlaceImageFormatInfo | null {
  if (!bytes || bytes.length < 12) {
    return null;
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}

export function isValidPlaceStoragePath(
  storagePath: string,
  lugarId?: string,
): boolean {
  if (!storagePath || typeof storagePath !== "string") return false;

  const regex = /^[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$/;
  if (!regex.test(storagePath)) return false;

  if (lugarId) {
    return storagePath.toLowerCase().startsWith(`${lugarId.toLowerCase()}/`);
  }

  return true;
}

export function generatePlaceStoragePath(
  lugarId: string,
  extension: "jpg" | "png" | "webp",
): string {
  const fileUuid = crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
  return `${lugarId}/${fileUuid}.${extension}`;
}

export interface PlaceImageValidation {
  /** Formato detectado, o null cuando los bytes no son una imagen soportada. */
  format: PlaceImageFormatInfo | null;
  error: string | null;
}

/**
 * Revisa tamaño y firma binaria antes de tocar el bucket. La extensión que
 * declara el archivo no se usa: manda el contenido real.
 */
export function validatePlaceImageBytes(bytes: Uint8Array): PlaceImageValidation {
  if (!bytes || bytes.byteLength === 0) {
    return { format: null, error: "El archivo está vacío" };
  }

  if (bytes.byteLength > MAX_PLACE_IMAGE_SIZE_BYTES) {
    return { format: null, error: "La imagen no debe superar los 5 MB" };
  }

  const format = detectPlaceImageFormat(bytes);
  if (!format) {
    return { format: null, error: "Formato no soportado: usa JPEG, PNG o WebP" };
  }

  return { format, error: null };
}
