import { describe, expect, it } from 'vitest';

import {
  MAX_PLACE_IMAGE_SIZE_BYTES,
  validatePlaceImageBytes,
} from '../utils/place-image';

function bytesConCabecera(cabecera: number[], relleno = 0): Uint8Array {
  const bytes = new Uint8Array(Math.max(16, cabecera.length));
  bytes.set(cabecera, 0);
  if (relleno > 0) {
    bytes[bytes.length - 1] = relleno;
  }
  return bytes;
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// RIFF....WEBP
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

describe('places-storage — validatePlaceImageBytes', () => {
  it('rechaza un archivo vacío', () => {
    const resultado = validatePlaceImageBytes(new Uint8Array(0));
    expect(resultado.format).toBeNull();
    expect(resultado.error).toContain('vacío');
  });

  it('acepta JPEG y devuelve la extensión correcta', () => {
    const resultado = validatePlaceImageBytes(bytesConCabecera(JPEG));
    expect(resultado.error).toBeNull();
    expect(resultado.format).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
  });

  it('acepta PNG', () => {
    const resultado = validatePlaceImageBytes(bytesConCabecera(PNG));
    expect(resultado.format).toEqual({ mime: 'image/png', ext: 'png' });
  });

  it('acepta WebP', () => {
    const resultado = validatePlaceImageBytes(bytesConCabecera(WEBP));
    expect(resultado.format).toEqual({ mime: 'image/webp', ext: 'webp' });
  });

  it('rechaza contenido que no es una imagen', () => {
    const resultado = validatePlaceImageBytes(bytesConCabecera([0x25, 0x50, 0x44, 0x46]));
    expect(resultado.format).toBeNull();
    expect(resultado.error).toContain('Formato no soportado');
  });

  it('rechaza imágenes de más de 5 MB', () => {
    const grande = new Uint8Array(MAX_PLACE_IMAGE_SIZE_BYTES + 1);
    grande.set(JPEG, 0);

    const resultado = validatePlaceImageBytes(grande);
    expect(resultado.format).toBeNull();
    expect(resultado.error).toContain('5 MB');
  });
});
