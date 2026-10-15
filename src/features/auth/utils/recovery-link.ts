/**
 * Utilidades para el análisis y procesamiento de enlaces de recuperación de contraseña en Chaski.
 *
 * Soporta los mecanismos oficiales de Supabase Auth:
 *  1. Código PKCE (auth code): exchangeCodeForSession(code)
 *  2. Token Hash: verifyOtp({ token_hash, type: 'recovery' })
 *  3. Tokens de sesión implícitos: setSession({ access_token, refresh_token })
 *
 * No expone credenciales en logs ni almacena tokens sensibles en almacenamiento persistente.
 *
 * Este módulo es intencionalmente puro: no importa Supabase. El canje de enlaces
 * contra Supabase Auth vive en services/recovery.service.ts.
 */

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
 * Parámetros de ruta (expo-router) que pueden portar una carga útil de recuperación.
 */
export interface RecoveryRouteParams {
  code?: string;
  token_hash?: string;
  type?: string;
  error?: string;
  error_description?: string;
}

/**
 * Combina los parámetros analizados desde la URL con los parámetros de ruta,
 * dando prioridad a la URL (query/fragment) sobre la ruta cuando ambos existen.
 * `accessToken`/`refreshToken` solo existen en el fragmento de la URL.
 * Operación pura: no depende de Supabase ni de React.
 */
export function combineRecoveryParams(
  urlParams: ParsedRecoveryParams,
  routeParams: RecoveryRouteParams = {},
): ParsedRecoveryParams {
  return {
    code: urlParams.code || routeParams.code,
    tokenHash: urlParams.tokenHash || routeParams.token_hash,
    type: urlParams.type || routeParams.type,
    accessToken: urlParams.accessToken,
    refreshToken: urlParams.refreshToken,
    error: urlParams.error || routeParams.error,
    errorDescription: urlParams.errorDescription || routeParams.error_description,
  };
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
