import { describe, expect, it } from 'vitest';

import { generatePlaceStoragePath } from '@/features/places/utils/place-image';

import { generateUuid } from '../uuid';

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateUuid', () => {
  it('devuelve un identificador con formato UUID v4', () => {
    expect(generateUuid()).toMatch(FORMATO_UUID);
  });

  it('no repite identificadores', () => {
    const generados = new Set(Array.from({ length: 200 }, () => generateUuid()));
    expect(generados.size).toBe(200);
  });

  it('funciona cuando el entorno no ofrece crypto (caso React Native)', () => {
    const original = (globalThis as { crypto?: unknown }).crypto;
    try {
      // Hermes no expone `crypto`: el generador debe seguir respondiendo.
      delete (globalThis as { crypto?: unknown }).crypto;
      expect(generateUuid()).toMatch(FORMATO_UUID);
    } finally {
      (globalThis as { crypto?: unknown }).crypto = original;
    }
  });
});

describe('generatePlaceStoragePath', () => {
  const LUGAR = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

  it('usa el id del destino como carpeta, como exige la base', () => {
    const ruta = generatePlaceStoragePath(LUGAR, 'jpg');
    expect(ruta.startsWith(`${LUGAR}/`)).toBe(true);
  });

  it('cumple el formato que valida la tabla lugares_imagenes', () => {
    const ruta = generatePlaceStoragePath(LUGAR, 'webp');
    expect(ruta).toMatch(/^[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$/);
    expect(ruta.endsWith('.webp')).toBe(true);
  });

  it('genera una ruta distinta en cada subida', () => {
    const primera = generatePlaceStoragePath(LUGAR, 'jpg');
    const segunda = generatePlaceStoragePath(LUGAR, 'jpg');
    expect(primera).not.toBe(segunda);
  });
});
