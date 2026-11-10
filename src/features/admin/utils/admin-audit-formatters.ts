/**
 * Textos legibles del historial de auditoría administrativa.
 *
 * Son funciones puras: reciben lo que devuelve la base y devuelven frases para
 * la pantalla. Se prueban sin React y se reutilizan en cualquier vista futura.
 */

import { formatMobilityLabel } from './admin-plan-formatters';

const ACTION_LABELS: Record<string, string> = {
  EDITAR_USUARIO: 'Editó un usuario',
  ANONIMIZAR_USUARIO: 'Dio de baja una cuenta',
  SUSPENDER_USUARIO: 'Suspendió un acceso',
  REACTIVAR_USUARIO: 'Reactivó un acceso',
  ELIMINAR_SOLICITUD: 'Eliminó una solicitud',
  ELIMINAR_EXPEDICION: 'Eliminó una expedición',
};

/** Acciones que quitan acceso o borran información: se pintan en rojo. */
const DESTRUCTIVE_ACTIONS = new Set<string>([
  'ANONIMIZAR_USUARIO',
  'SUSPENDER_USUARIO',
  'ELIMINAR_SOLICITUD',
  'ELIMINAR_EXPEDICION',
]);

const ACCION_DESCONOCIDA = 'Acción desconocida';
const SIN_DETALLE = 'Sin detalle adicional';

function readText(source: Record<string, unknown> | null, key: string): string | null {
  if (!source) {
    return null;
  }
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readNumber(source: Record<string, unknown> | null, key: string): number | null {
  if (!source) {
    return null;
  }
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(source: Record<string, unknown> | null, key: string): boolean | null {
  if (!source) {
    return null;
  }
  const value = source[key];
  return typeof value === 'boolean' ? value : null;
}

function readObject(
  source: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!source) {
    return null;
  }
  const value = source[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Etiqueta legible de una acción. Si el código es nuevo, se muestra tal cual. */
export function formatAuditActionLabel(accion: string | null | undefined): string {
  if (!accion) {
    return ACCION_DESCONOCIDA;
  }
  return ACTION_LABELS[accion] ?? accion;
}

/** Indica si la acción quitó acceso o borró información. */
export function isDestructiveAuditAction(accion: string | null | undefined): boolean {
  return Boolean(accion) && DESTRUCTIVE_ACTIONS.has(accion as string);
}

/** Describe en una frase qué cambió la acción, leyendo el JSON de detalle. */
export function summarizeAuditDetail(
  accion: string | null | undefined,
  detalle: Record<string, unknown> | null | undefined,
): string {
  const datos = detalle ?? {};

  switch (accion) {
    case 'EDITAR_USUARIO':
    case 'ANONIMIZAR_USUARIO':
    case 'SUSPENDER_USUARIO':
    case 'REACTIVAR_USUARIO': {
      const antes = readObject(datos, 'antes');
      const despues = readObject(datos, 'despues');
      const cambios: string[] = [];

      const nombreAntes = readText(antes, 'nombre');
      const nombreDespues = readText(despues, 'nombre');
      if (nombreAntes && nombreDespues && nombreAntes !== nombreDespues) {
        cambios.push(`Nombre: ${nombreAntes} → ${nombreDespues}`);
      }

      const rolAntes = readText(antes, 'rol');
      const rolDespues = readText(despues, 'rol');
      if (rolAntes && rolDespues && rolAntes !== rolDespues) {
        cambios.push(`Rol: ${rolAntes} → ${rolDespues}`);
      }

      const estadoAntes = readBoolean(antes, 'estado');
      const estadoDespues = readBoolean(despues, 'estado');
      if (estadoAntes !== null && estadoDespues !== null && estadoAntes !== estadoDespues) {
        cambios.push(estadoDespues ? 'Acceso reactivado' : 'Acceso suspendido');
      }

      return cambios.length > 0 ? cambios.join(' · ') : SIN_DETALLE;
    }

    case 'ELIMINAR_SOLICITUD': {
      const partes: string[] = [];
      const movilidad = readText(datos, 'movilidad');
      if (movilidad) {
        partes.push(`Movilidad: ${formatMobilityLabel(movilidad)}`);
      }
      const gasto = readNumber(datos, 'gasto_max');
      if (gasto !== null) {
        partes.push(`Gasto máximo: S/ ${gasto}`);
      }
      return partes.length > 0 ? partes.join(' · ') : SIN_DETALLE;
    }

    case 'ELIMINAR_EXPEDICION': {
      const partes: string[] = [];
      const estado = readText(datos, 'estado_expedicion');
      if (estado) {
        partes.push(`Estado: ${estado}`);
      }
      const paradas = readNumber(datos, 'paradas_visitadas');
      if (paradas !== null) {
        partes.push(`Paradas visitadas: ${paradas}`);
      }
      return partes.length > 0 ? partes.join(' · ') : SIN_DETALLE;
    }

    default:
      return SIN_DETALLE;
  }
}
