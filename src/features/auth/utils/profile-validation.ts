export interface ProfileNameValidationResult {
  isValid: boolean;
  error?: string;
  trimmedName?: string;
}

export function validateProfileName(name: string): ProfileNameValidationResult {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'Ingresa tu nombre completo' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { isValid: false, error: 'El nombre debe tener al menos 2 caracteres' };
  }

  if (trimmed.length > 60) {
    return { isValid: false, error: 'El nombre no puede exceder 60 caracteres' };
  }

  return { isValid: true, trimmedName: trimmed };
}

export function formatMembershipDate(isoDate?: string | null): string {
  if (!isoDate) {
    return 'Fecha no disponible';
  }

  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) {
      return 'Fecha no disponible';
    }

    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];

    const dia = date.getDate();
    const mes = meses[date.getMonth()];
    const anio = date.getFullYear();

    return `${dia} de ${mes} de ${anio}`;
  } catch {
    return 'Fecha no disponible';
  }
}
