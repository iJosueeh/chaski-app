/**
 * `useRecoveryHandler` — gestión de enlaces de recuperación de contraseña.
 *
 * Extraído de la pantalla de restablecer contraseña. Coordina:
 * 1. Caso A: verificación OTP previa (flags + sesión) → formulario directo.
 * 2. Caso B: ya verificado en este ciclo → no reprocesar.
 * 3. Retrocompatibilidad con deep links (PKCE / Token Hash / Tokens) con
 *    protección frente a duplicados: las cargas en vuelo se REUTILIZAN
 *    (StrictMode, re-entradas por cambios de dependencias, remontajes) y las
 *    ya canjeadas no se vuelven a consumir.
 * 4. Suscripción a deep links (`Linking.useURL`) y limpieza al desmontar.
 *
 * Responsabilidades repartidas:
 * - utils/recovery-link.ts: parseo puro + registro de huellas.
 * - services/recovery.service.ts: canje contra Supabase Auth.
 * - El hook: suscripción, carreras y estados de la pantalla (processing,
 *   isVerified, error). Navegación y formulario permanecen en la pantalla.
 */
import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';

import { signOut } from '../services/auth.service';
import { getAuthSession, processRecoveryLink, type ProcessRecoveryResult } from '../services/recovery.service';
import {
  canProcessPayload,
  combineRecoveryParams,
  getRecoveryFingerprint,
  hasRecoveryPayload,
  markPayloadFailed,
  markPayloadInFlight,
  markPayloadSuccess,
  parseRecoveryUrl,
  type ParsedRecoveryParams,
  type RecoveryRouteParams,
} from '../utils/recovery-link';

export type RecoveryErrorKind = 'no-payload' | 'link-failed' | 'exception';

export type RecoveryHandlingOutcome =
  | { status: 'verified' }
  | { status: 'skipped'; reason: 'already-processed' }
  | { status: 'error'; kind: RecoveryErrorKind; detail: string | null };

/** Canje compartido por huella: una sola ejecución por enlace, reutilizada por re-entradas. */
const recoveryRuns = new Map<string, Promise<RecoveryHandlingOutcome>>();

/** Limpia las ejecuciones en curso (pruebas y reinicios). */
export function resetRecoveryRuns(): void {
  recoveryRuns.clear();
}

/**
 * Mensaje visible de un fallo de recuperación (copy histórico 1:1).
 */
export function recoveryErrorMessage(outcome: {
  kind: RecoveryErrorKind;
  detail: string | null;
}): string {
  switch (outcome.kind) {
    case 'no-payload':
      return 'No se detectó un enlace de recuperación válido. Para restablecer tu contraseña, solicita un nuevo enlace.';
    case 'link-failed':
      return outcome.detail || 'El enlace de recuperación es inválido, ha expirado o ya ha sido utilizado.';
    default:
      return outcome.detail || 'Error al procesar el enlace de recuperación. Comprueba tu conexión e intenta nuevamente.';
  }
}

export type RecoveryScreenPatch = {
  processing?: boolean;
  isVerified?: boolean;
  error?: string;
};

/**
 * Traduce un resultado de manejo al parche de estados de pantalla (puro).
 * `null` = no tocar la pantalla.
 */
export function resolveRecoveryScreenPatch(
  outcome: RecoveryHandlingOutcome,
): RecoveryScreenPatch | null {
  switch (outcome.status) {
    case 'verified':
      return { processing: false, isVerified: true, error: '' };
    case 'error':
      return { processing: false, isVerified: false, error: recoveryErrorMessage(outcome) };
    default:
      // 'already-processed': solo cerrar el spinner (semántica histórica del Caso B).
      return { processing: false };
  }
}

/**
 * Ejecuta el manejo de un enlace de recuperación.
 *
 * Las banderas del contexto (`setIsPasswordRecovery`/`setIsRecoveryVerified`), el
 * registro de huellas y `signOut` se aplican aunque la pantalla se haya
 * desmontado: son coordinación de sesión, no estado de pantalla. El llamador
 * aplica el parche de pantalla solo si sigue montado.
 */
export async function runRecoveryHandling(options: {
  params: ParsedRecoveryParams;
  session: Session | null;
  isPasswordRecovery: boolean;
  isRecoveryVerified: boolean;
  isVerified: boolean;
  setIsPasswordRecovery: (isRecovery: boolean) => void;
  setIsRecoveryVerified: (isVerified: boolean) => void;
  getSession: () => Promise<{ data: { session: Session | null } }>;
  processRecoveryLink: (params: ParsedRecoveryParams) => Promise<ProcessRecoveryResult>;
  signOut: () => Promise<unknown>;
  /** Inicia el canje (la pantalla muestra su spinner). Se invoca tras las guardas. */
  onStartingExchange?: () => void;
}): Promise<RecoveryHandlingOutcome> {
  const opts = options;

  try {
    // 1. Caso A: Verificación OTP previa exitosa.
    // Si la sesión temporal aún no se ha sincronizado en el estado de React,
    // consultamos getSession().
    let activeSession = opts.session;
    if (!activeSession && (opts.isRecoveryVerified || opts.isPasswordRecovery)) {
      const sessionRes = await opts.getSession();
      activeSession = sessionRes?.data?.session ?? null;
    }

    if (opts.isRecoveryVerified && activeSession) {
      opts.setIsPasswordRecovery(true);
      return { status: 'verified' };
    }

    // 2. Caso B: si ya está verificado en este ciclo, no reprocesar.
    if (opts.isPasswordRecovery && opts.isVerified) {
      return { status: 'skipped', reason: 'already-processed' };
    }

    // 3. Retrocompatibilidad con enlaces Deep Link (PKCE / Token Hash / Tokens).
    const params = opts.params;
    if (!hasRecoveryPayload(params)) {
      // Ni verificación OTP previa ni carga útil de deep link: acceso no autorizado
      opts.setIsPasswordRecovery(false);
      opts.setIsRecoveryVerified(false);
      return { status: 'error', kind: 'no-payload', detail: null };
    }

    const fingerprint = getRecoveryFingerprint(params);

    if (fingerprint) {
      // Protección frente a duplicados: si ya hay un canje en curso para esta
      // huella, reutilizarlo en lugar de consumir el enlace una segunda vez.
      const inFlight = recoveryRuns.get(fingerprint);
      if (inFlight) {
        opts.onStartingExchange?.();
        return inFlight;
      }
      // Huella ya canjeadada sin ejecución viva: el enlace no se reutiliza.
      if (!canProcessPayload(fingerprint)) {
        return {
          status: 'error',
          kind: 'link-failed',
          detail: null,
        };
      }
      markPayloadInFlight(fingerprint);
    }

    opts.onStartingExchange?.();

    // Prevenir desmontaje en _layout.tsx durante el canje PKCE
    opts.setIsPasswordRecovery(true);

    const run = (async (): Promise<RecoveryHandlingOutcome> => {
      try {
        const result = await opts.processRecoveryLink(params);

        if (result.success) {
          if (fingerprint) markPayloadSuccess(fingerprint);
          opts.setIsRecoveryVerified(true);
          return { status: 'verified' };
        }

        if (fingerprint) markPayloadFailed(fingerprint);
        opts.setIsPasswordRecovery(false);
        opts.setIsRecoveryVerified(false);
        await opts.signOut();
        return { status: 'error', kind: 'link-failed', detail: result.error ?? null };
      } catch (err) {
        if (fingerprint) markPayloadFailed(fingerprint);
        opts.setIsPasswordRecovery(false);
        opts.setIsRecoveryVerified(false);
        try {
          await opts.signOut();
        } catch {
          // El cierre de sesión auxiliar no debe enmascarar el error original.
        }
        return {
          status: 'error',
          kind: 'exception',
          detail: (err as { message?: string } | null)?.message ?? null,
        };
      }
    })();

    if (fingerprint) {
      const tracked = run.finally(() => {
        recoveryRuns.delete(fingerprint);
      });
      recoveryRuns.set(fingerprint, tracked);
      return tracked;
    }

    return await run;
  } catch (err) {
    // Fallo inesperado fuera del canje (p. ej. getSession): tratar como excepción.
    return {
      status: 'error',
      kind: 'exception',
      detail: (err as { message?: string } | null)?.message ?? null,
    };
  }
}

export type UseRecoveryHandlerResult = {
  /** true mientras se resuelve el enlace de recuperación. */
  processing: boolean;
  /** true cuando el enlace/OTP quedó verificado y el formulario está habilitado. */
  isVerified: boolean;
  /** Mensaje visible del fallo de enlace ('' si no hay fallo). */
  error: string;
};

/**
 * Hook de manejo de enlaces de recuperación: suscripción a deep links,
 * carreras/duplicados y estados de la pantalla.
 */
export function useRecoveryHandler(options: {
  routeParams: RecoveryRouteParams;
  session: Session | null;
  isPasswordRecovery: boolean;
  isRecoveryVerified: boolean;
  setIsPasswordRecovery: (isRecovery: boolean) => void;
  setIsRecoveryVerified: (isVerified: boolean) => void;
}): UseRecoveryHandlerResult {
  const {
    routeParams,
    session,
    isPasswordRecovery,
    isRecoveryVerified,
    setIsPasswordRecovery,
    setIsRecoveryVerified,
  } = options;

  const incomingUrl = Linking.useURL();

  // Estados de flujo y verificación
  const [processing, setProcessing] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const params = combineRecoveryParams(parseRecoveryUrl(incomingUrl), routeParams);

    runRecoveryHandling({
      params,
      session,
      isPasswordRecovery,
      isRecoveryVerified,
      isVerified,
      setIsPasswordRecovery,
      setIsRecoveryVerified,
      getSession: getAuthSession,
      processRecoveryLink: (p) => processRecoveryLink(p),
      signOut: () => signOut(),
      onStartingExchange: () => {
        if (!isMounted) return;
        setProcessing(true);
        setError('');
      },
    }).then((outcome) => {
      if (!isMounted) return;
      const patch = resolveRecoveryScreenPatch(outcome);
      if (!patch) return;
      if (patch.processing !== undefined) setProcessing(patch.processing);
      if (patch.isVerified !== undefined) setIsVerified(patch.isVerified);
      if (patch.error !== undefined) setError(patch.error);
    });

    return () => {
      isMounted = false;
    };
  }, [
    incomingUrl,
    routeParams,
    session,
    isPasswordRecovery,
    isRecoveryVerified,
    isVerified,
    setIsPasswordRecovery,
    setIsRecoveryVerified,
  ]);

  return { processing, isVerified, error };
}
