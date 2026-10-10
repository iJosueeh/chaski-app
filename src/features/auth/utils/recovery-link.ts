/**
 * Utilidades para el análisis y procesamiento de enlaces de recuperación de contraseña en Chaski.
 *
 * Soporta los mecanismos oficiales de Supabase Auth:
 *  1. Código PKCE (auth code): exchangeCodeForSession(code)
 *  2. Token Hash: verifyOtp({ token_hash, type: 'recovery' })
 *  3. Tokens de sesión implícitos: setSession({ access_token, refresh_token })
 *
 * No expone credenciales en logs ni almacena tokens sensibles en almacenamiento persistente.
 */

import { supabase } from '@/lib/supabase';

export interface ParsedRecoveryParams {
  code?: string;
  tokenHash?: string;
  type?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  errorDescription?: string;
}

/**
 * Analiza una URL de deep link extrayendo de forma segura los parámetros de recuperación,
 * soportando tanto query parameters (?code=...) como fragmentos hash (#access_token=...).
 */
export function parseRecoveryUrl(url: string | null | undefined): ParsedRecoveryParams {
  if (!url || typeof url !== 'string') return {};

  const result: ParsedRecoveryParams = {};

  try {
    const queryIndex = url.indexOf('?');
    const hashIndex = url.indexOf('#');

    let queryString = '';
    let hashString = '';

    if (queryIndex !== -1) {
      queryString =
        hashIndex !== -1 && hashIndex > queryIndex
          ? url.substring(queryIndex + 1, hashIndex)
          : url.substring(queryIndex + 1);
    }

    if (hashIndex !== -1) {
      hashString = url.substring(hashIndex + 1);
    }

    const parseKeyValuePairs = (str: string) => {
      const params: Record<string, string> = {};
      const pairs = str.split('&');
      for (const pair of pairs) {
        if (!pair) continue;
        const [k, v] = pair.split('=');
        if (k) {
          try {
            params[decodeURIComponent(k)] = v
              ? decodeURIComponent(v.replace(/\+/g, ' '))
              : '';
          } catch {
            params[k] = v ?? '';
          }
        }
      }
      return params;
    };

    const queryParams = parseKeyValuePairs(queryString);
    const hashParams = parseKeyValuePairs(hashString);
    const combined = { ...queryParams, ...hashParams };

    if (combined.code) result.code = combined.code;
    if (combined.token_hash) result.tokenHash = combined.token_hash;
    if (combined.type) result.type = combined.type;
    if (combined.access_token) result.accessToken = combined.access_token;
    if (combined.refresh_token) result.refreshToken = combined.refresh_token;
    if (combined.error) result.error = combined.error;
    if (combined.error_description) result.errorDescription = combined.error_description;
  } catch {
    // URL malformada: retorna objeto vacío sin lanzar excepciones
  }

  return result;
}

/**
 * Determina si los parámetros analizados contienen alguna credencial o error de recuperación.
 */
export function hasRecoveryPayload(params: ParsedRecoveryParams): boolean {
  return Boolean(
    params.code ||
      params.tokenHash ||
      (params.accessToken && params.refreshToken) ||
      params.error,
  );
}

/**
 * Obtiene un identificador único para el enlace para compatibilidad.
 */
export function getRecoveryPayloadKey(params: ParsedRecoveryParams): string | null {
  if (params.code) return `code:${params.code}`;
  if (params.tokenHash) return `hash:${params.tokenHash}`;
  if (params.accessToken) return `token:${params.accessToken}`;
  if (params.error) return `error:${params.error}:${params.errorDescription ?? ''}`;
  return null;
}

/**
 * Función de hashing determinista no criptográfico para generar huellas ofuscadas
 * sin retener códigos de autorización ni tokens sensibles en memoria.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

/**
 * Obtiene una huella digital no reversible del enlace de recuperación.
 * Evita almacenar tokens, contraseñas o códigos PKCE reales en memoria de forma persistente.
 */
export function getRecoveryFingerprint(params: ParsedRecoveryParams): string | null {
  if (params.code) return `code:${simpleHash(params.code)}`;
  if (params.tokenHash) return `hash:${simpleHash(params.tokenHash)}`;
  if (params.accessToken) return `token:${simpleHash(params.accessToken)}`;
  if (params.error) return `error:${params.error}:${simpleHash(params.errorDescription ?? '')}`;
  return null;
}

export type RecoveryPayloadStatus = 'in_flight' | 'success' | 'failed';

interface RegistryEntry {
  status: RecoveryPayloadStatus;
  timestamp: number;
}

// Registro en memoria de huellas procesadas
const payloadRegistry = new Map<string, RegistryEntry>();

/**
 * Consulta el estado actual de procesamiento de una huella.
 */
export function getPayloadStatus(fingerprint: string): RecoveryPayloadStatus | null {
  return payloadRegistry.get(fingerprint)?.status ?? null;
}

/**
 * Determina si una carga puede ser procesada.
 * - Bloquea si ya está en curso ('in_flight') para prevenir consumo concurrente.
 * - Bloquea si ya fue canjeada exitosamente ('success') para evitar reintentos de códigos consumidos.
 * - Permite procesar si falló ('failed') para tolerar fallos transitorios de red.
 */
export function canProcessPayload(fingerprint: string): boolean {
  const entry = payloadRegistry.get(fingerprint);
  if (!entry) return true;
  if (entry.status === 'in_flight' || entry.status === 'success') {
    return false;
  }
  return true;
}

/**
 * Marca atómicamente una huella como 'in_flight' si está disponible.
 * Retorna true si se adquirió el bloqueo, false si ya estaba en curso o exitosa.
 */
export function markPayloadInFlight(fingerprint: string): boolean {
  if (!canProcessPayload(fingerprint)) return false;
  payloadRegistry.set(fingerprint, { status: 'in_flight', timestamp: Date.now() });
  return true;
}

/**
 * Marca una huella como exitosamente canjeada ('success').
 */
export function markPayloadSuccess(fingerprint: string): void {
  payloadRegistry.set(fingerprint, { status: 'success', timestamp: Date.now() });
}

/**
 * Marca una huella como fallida ('failed'), permitiendo reintentos ante caídas transitorias de red.
 */
export function markPayloadFailed(fingerprint: string): void {
  payloadRegistry.set(fingerprint, { status: 'failed', timestamp: Date.now() });
}

/**
 * Limpia el registro de huellas (útil en pruebas y reinicio).
 */
export function resetPayloadRegistry(): void {
  payloadRegistry.clear();
}

export interface ProcessRecoveryResult {
  success: boolean;
  error?: string;
}

/**
 * Procesa los parámetros de recuperación contra Supabase Auth mediante el mecanismo oficial correspondiente.
 */
export async function processRecoveryLink(
  params: ParsedRecoveryParams,
): Promise<ProcessRecoveryResult> {
  // Manejo de errores devueltos por el proveedor
  if (params.error) {
    return {
      success: false,
      error:
        params.errorDescription ||
        params.error ||
        'El enlace de recuperación es inválido o ha expirado.',
    };
  }

  // 1. Mecanismo PKCE: código de autorización
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      return {
        success: false,
        error:
          error.message ||
          'No se pudo intercambiar el código de autorización. El enlace puede haber expirado.',
      };
    }
    return { success: true };
  }

  // 2. Mecanismo Token Hash: verifyOtp con tipo recovery
  if (params.tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.tokenHash,
      type: 'recovery',
    });
    if (error) {
      return {
        success: false,
        error:
          error.message ||
          'El token de recuperación es inválido o ha expirado.',
      };
    }
    return { success: true };
  }

  // 3. Mecanismo de Tokens de Sesión (Hash fragment)
  if (params.accessToken && params.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (error) {
      return {
        success: false,
        error:
          error.message ||
          'No se pudo establecer la sesión de recuperación con los tokens provistos.',
      };
    }
    return { success: true };
  }

  return {
    success: false,
    error: 'El enlace no contiene credenciales de recuperación válidas.',
  };
}
