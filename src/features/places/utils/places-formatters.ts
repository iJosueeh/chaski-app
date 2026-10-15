export interface PlaceBudgetLabel {
  label: string;
  isFree: boolean;
}

export function formatPlaceBudget(
  min: number | null | undefined,
  max: number | null | undefined,
): PlaceBudgetLabel {
  const hasMin = typeof min === 'number' && min > 0;
  const hasMax = typeof max === 'number' && max > 0;

  if (hasMin && hasMax) {
    return { label: `S/ ${min} — S/ ${max}`, isFree: false };
  }

  if (hasMin) {
    return { label: `Desde S/ ${min}`, isFree: false };
  }

  if (min === 0 && hasMax) {
    return { label: `Gratis · hasta S/ ${max}`, isFree: true };
  }

  if (hasMax) {
    return { label: `Hasta S/ ${max}`, isFree: false };
  }

  return { label: 'Entrada gratis', isFree: true };
}

export function formatPlaceDuration(minutes: number | null | undefined): string | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }

  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);

  if (hours > 0 && rest > 0) return `${hours} h ${rest} min`;
  if (hours > 0) return `${hours} h`;
  return `${rest} min`;
}

export function formatPlaceFolio(id: string | null | undefined): string {
  const source = id ?? '';
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  const serial = (hash % 90000) + 10000;
  return `AX-${serial}`;
}

export function getPlacePrimaryCategory(
  categorias: readonly { nombre: string }[] | null | undefined,
  fallback = 'PATRIMONIO',
): string {
  const first = categorias?.[0]?.nombre?.trim();
  return first ? first : fallback;
}

export function getPlaceCategoryNames(
  categorias: readonly { nombre: string }[] | null | undefined,
  limit = 3,
): string[] {
  if (!categorias || limit <= 0) return [];
  return categorias
    .map(categoria => categoria?.nombre?.trim())
    .filter((nombre): nombre is string => Boolean(nombre))
    .slice(0, limit);
}

export function getPlacePhotoAlt(nombre: string | null | undefined): string {
  const clean = nombre?.trim();
  return clean ? `Fotografía de ${clean}` : 'Fotografía del destino';
}
