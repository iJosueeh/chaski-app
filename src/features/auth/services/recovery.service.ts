import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

import type { ParsedRecoveryParams } from '../utils/recovery-link';

export interface ProcessRecoveryResult {
  success: boolean;
  error?: string;
}

export async function getAuthSession(): Promise<{ data: { session: Session | null } }> {
  const res = await supabase.auth.getSession();
  return { data: { session: res?.data?.session ?? null } };
}

export async function processRecoveryLink(
  params: ParsedRecoveryParams,
): Promise<ProcessRecoveryResult> {
  if (params.error) {
    return {
      success: false,
      error:
        params.errorDescription ||
        params.error ||
        'El enlace de recuperación es inválido o ha expirado.',
    };
  }

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
