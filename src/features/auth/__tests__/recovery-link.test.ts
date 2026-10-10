import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canProcessPayload,
  getPayloadStatus,
  getRecoveryFingerprint,
  getRecoveryPayloadKey,
  hasRecoveryPayload,
  markPayloadFailed,
  markPayloadInFlight,
  markPayloadSuccess,
  parseRecoveryUrl,
  processRecoveryLink,
  resetPayloadRegistry,
} from '../utils/recovery-link';
import { supabase } from '@/lib/supabase';
import {
  updatePassword,
  requestPasswordReset,
  getResetPasswordRedirectUrl,
  signOut,
} from '../services/auth.service';

vi.mock('expo-linking', () => ({
  createURL: vi.fn((path: string) => `chaski://${path.replace(/^\//, '')}`),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: vi.fn(),
      verifyOtp: vi.fn(),
      setSession: vi.fn(),
      updateUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

describe('Procesamiento de Enlaces de Recuperación de Contraseña', () => {
  describe('1. Análisis de URLs (parseRecoveryUrl)', () => {
    it('extrae correctamente el código PKCE desde query parameters', () => {
      const url = 'chaski://reset-password?code=auth_code_pkce_12345';
      const parsed = parseRecoveryUrl(url);

      expect(parsed.code).toBe('auth_code_pkce_12345');
      expect(parsed.tokenHash).toBeUndefined();
      expect(parsed.accessToken).toBeUndefined();
      expect(hasRecoveryPayload(parsed)).toBe(true);
    });

    it('extrae correctamente el token_hash y tipo de verificación desde query parameters', () => {
      const url = 'chaski://reset-password?token_hash=th_abc123&type=recovery';
      const parsed = parseRecoveryUrl(url);

      expect(parsed.tokenHash).toBe('th_abc123');
      expect(parsed.type).toBe('recovery');
      expect(parsed.code).toBeUndefined();
      expect(hasRecoveryPayload(parsed)).toBe(true);
    });

    it('extrae correctamente access_token y refresh_token desde fragmento hash (#)', () => {
      const url =
        'chaski://reset-password#access_token=jwt_access_abc&refresh_token=jwt_refresh_def&type=recovery';
      const parsed = parseRecoveryUrl(url);

      expect(parsed.accessToken).toBe('jwt_access_abc');
      expect(parsed.refreshToken).toBe('jwt_refresh_def');
      expect(parsed.type).toBe('recovery');
      expect(hasRecoveryPayload(parsed)).toBe(true);
    });

    it('captura códigos de error devueltos en la redirección por Supabase', () => {
      const url =
        'chaski://reset-password?error=access_denied&error_description=Token+has+expired';
      const parsed = parseRecoveryUrl(url);

      expect(parsed.error).toBe('access_denied');
      expect(parsed.errorDescription).toBe('Token has expired');
      expect(hasRecoveryPayload(parsed)).toBe(true);
    });

    it('retorna objeto vacío y hasRecoveryPayload falso si la URL no contiene credenciales', () => {
      const parsed1 = parseRecoveryUrl('chaski://reset-password');
      expect(parsed1).toEqual({});
      expect(hasRecoveryPayload(parsed1)).toBe(false);

      const parsed2 = parseRecoveryUrl('');
      expect(parsed2).toEqual({});
      expect(hasRecoveryPayload(parsed2)).toBe(false);

      const parsed3 = parseRecoveryUrl(null);
      expect(parsed3).toEqual({});
      expect(hasRecoveryPayload(parsed3)).toBe(false);
    });
  });

  describe('2. Control de Envíos Duplicados e Identificador de Carga', () => {
    it('genera una clave única consistente para evitar procesamientos duplicados', () => {
      const params1 = { code: 'pkce_code_1' };
      const params2 = { tokenHash: 'hash_123' };
      const params3 = { accessToken: 'token_abc', refreshToken: 'ref_123' };

      expect(getRecoveryPayloadKey(params1)).toBe('code:pkce_code_1');
      expect(getRecoveryPayloadKey(params2)).toBe('hash:hash_123');
      expect(getRecoveryPayloadKey(params3)).toBe('token:token_abc');

      const processedSet = new Set<string>();
      const key = getRecoveryPayloadKey(params1)!;

      expect(processedSet.has(key)).toBe(false);
      processedSet.add(key);
      expect(processedSet.has(key)).toBe(true);
    });
  });

  describe('3. Procesamiento de Mecanismos Oficiales (processRecoveryLink)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('procesa exitosamente un código de autorización PKCE oficial', async () => {
      const exchangeSpy = vi
        .spyOn(supabase.auth, 'exchangeCodeForSession')
        .mockResolvedValueOnce({
          data: { user: {} as any, session: {} as any },
          error: null,
        });

      const result = await processRecoveryLink({ code: 'pkce_code_valido' });

      expect(exchangeSpy).toHaveBeenCalledWith('pkce_code_valido');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('procesa exitosamente un token_hash con verifyOtp tipo recovery', async () => {
      const verifyOtpSpy = vi
        .spyOn(supabase.auth, 'verifyOtp')
        .mockResolvedValueOnce({
          data: { user: {} as any, session: {} as any },
          error: null,
        });

      const result = await processRecoveryLink({
        tokenHash: 'token_hash_valido',
        type: 'recovery',
      });

      expect(verifyOtpSpy).toHaveBeenCalledWith({
        token_hash: 'token_hash_valido',
        type: 'recovery',
      });
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('procesa exitosamente tokens de sesión en flujo implícito con setSession', async () => {
      const setSessionSpy = vi
        .spyOn(supabase.auth, 'setSession')
        .mockResolvedValueOnce({
          data: { user: {} as any, session: {} as any },
          error: null,
        });

      const result = await processRecoveryLink({
        accessToken: 'access_jwt',
        refreshToken: 'refresh_jwt',
      });

      expect(setSessionSpy).toHaveBeenCalledWith({
        access_token: 'access_jwt',
        refresh_token: 'refresh_jwt',
      });
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('maneja errores cuando el código PKCE es inválido o ha expirado', async () => {
      vi.spyOn(supabase.auth, 'exchangeCodeForSession').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'El código de autorización ha expirado', name: 'AuthApiError', status: 400 } as any,
      });

      const result = await processRecoveryLink({ code: 'codigo_expirado' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ha expirado');
    });

    it('maneja errores cuando el token_hash de verifyOtp es inválido o reutilizado', async () => {
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Token has expired or is invalid', name: 'AuthApiError', status: 400 } as any,
      });

      const result = await processRecoveryLink({ tokenHash: 'hash_invalido' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Token has expired');
    });

    it('retorna error cuando no se suministra ninguna credencial en los parámetros', async () => {
      const result = await processRecoveryLink({});

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'El enlace no contiene credenciales de recuperación válidas.',
      );
    });

    it('retorna error si los parámetros ya traen un error desde Supabase', async () => {
      const result = await processRecoveryLink({
        error: 'access_denied',
        errorDescription: 'Email link is invalid or has expired',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email link is invalid or has expired');
    });
  });

  describe('4. Integración de Servicios (updatePassword y requestPasswordReset)', () => {
    it('llama a supabase.auth.updateUser al actualizar la contraseña', async () => {
      const updateSpy = vi
        .spyOn(supabase.auth, 'updateUser')
        .mockResolvedValueOnce({
          data: { user: {} as any },
          error: null,
        });

      const res = await updatePassword('nuevaClaveSegura123');
      expect(updateSpy).toHaveBeenCalledWith({ password: 'nuevaClaveSegura123' });
      expect(res.error).toBeNull();
    });

    it('genera la URL de redirección basada en Linking', () => {
      const redirectUrl = getResetPasswordRedirectUrl();
      expect(typeof redirectUrl).toBe('string');
      expect(redirectUrl).toContain('reset-password');
    });

    it('solicita el reseteo con el correo y la URL de redirección configurada', async () => {
      const resetSpy = vi
        .spyOn(supabase.auth, 'resetPasswordForEmail')
        .mockResolvedValueOnce({
          data: {},
          error: null,
        });

      await requestPasswordReset('turista@chaski.pe');
      expect(resetSpy).toHaveBeenCalledWith('turista@chaski.pe', expect.objectContaining({
        redirectTo: expect.stringContaining('reset-password'),
      }));
    });

    it('ejecuta signOut correctamente para invalidar sesiones al salir o cancelar', async () => {
      const signOutSpy = vi
        .spyOn(supabase.auth, 'signOut')
        .mockResolvedValueOnce({
          error: null,
        });

      const res = await signOut();
      expect(signOutSpy).toHaveBeenCalledTimes(1);
      expect(res.error).toBeNull();
    });
  });

  describe('5. Auditoría de Seguridad y Ciclo de Vida (Pruebas de Regresión)', () => {
    it('rechaza URLs normales o rutas de tabs sin parámetros de recuperación, impidiendo isVerified falso', () => {
      const regularUrls = [
        'chaski://tabs',
        'chaski://places?category=cultura',
        'chaski://preferences',
        'chaski://reset-password',
      ];

      for (const url of regularUrls) {
        const parsed = parseRecoveryUrl(url);
        expect(hasRecoveryPayload(parsed)).toBe(false);
        expect(getRecoveryPayloadKey(parsed)).toBeNull();
      }
    });

    it('asegura que las claves de deduplicación distingan entre distintos códigos y tipos', () => {
      const keyA = getRecoveryPayloadKey({ code: 'code_aaa' });
      const keyB = getRecoveryPayloadKey({ code: 'code_bbb' });
      const keyHash = getRecoveryPayloadKey({ tokenHash: 'hash_aaa' });

      expect(keyA).not.toBe(keyB);
      expect(keyA).not.toBe(keyHash);
      expect(keyA).toBe('code:code_aaa');
      expect(keyB).toBe('code:code_bbb');
      expect(keyHash).toBe('hash:hash_aaa');
    });

    it('procesa correctamente parámetros codificados en URL con caracteres especiales sin romper el parseo', () => {
      const url =
        'chaski://reset-password?error=access_denied&error_description=El+enlace+ha+expirado+%28token+inv%C3%A1lido%29';
      const parsed = parseRecoveryUrl(url);

      expect(parsed.error).toBe('access_denied');
      expect(parsed.errorDescription).toBe('El enlace ha expirado (token inválido)');
      expect(hasRecoveryPayload(parsed)).toBe(true);
    });

    it('asegura que URLs malformadas retornen objeto seguro sin lanzar excepciones', () => {
      expect(() => parseRecoveryUrl(':::not-a-valid-url:::')).not.toThrow();
      expect(() => parseRecoveryUrl(undefined as any)).not.toThrow();
      expect(() => parseRecoveryUrl(12345 as any)).not.toThrow();
    });

    describe('Máquina de Estados de Deduplicación y Protección de Secretos', () => {
      beforeEach(() => {
        resetPayloadRegistry();
      });

      it('genera huellas ofuscadas sin contener el código o token literal sensible', () => {
        const rawCode = 'super_secret_pkce_authorization_code_99999';
        const fp = getRecoveryFingerprint({ code: rawCode });

        expect(fp).toBeDefined();
        expect(fp).not.toContain(rawCode);
        expect(fp).toMatch(/^code:[a-f0-9]+$/);

        const rawToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive_payload';
        const fpToken = getRecoveryFingerprint({ accessToken: rawToken });
        expect(fpToken).toBeDefined();
        expect(fpToken).not.toContain(rawToken);
        expect(fpToken).toMatch(/^token:[a-f0-9]+$/);
      });

      it('previene el consumo concurrente simultáneo del mismo enlace (bloqueo in_flight)', () => {
        const fp = getRecoveryFingerprint({ code: 'pkce_concurrent_123' })!;

        expect(canProcessPayload(fp)).toBe(true);
        expect(getPayloadStatus(fp)).toBeNull();

        // Primera llamada adquiere el procesamiento
        const acquiredFirst = markPayloadInFlight(fp);
        expect(acquiredFirst).toBe(true);
        expect(getPayloadStatus(fp)).toBe('in_flight');

        // Segunda llamada simultánea es rechazada
        expect(canProcessPayload(fp)).toBe(false);
        const acquiredSecond = markPayloadInFlight(fp);
        expect(acquiredSecond).toBe(false);
      });

      it('permite reintentar el procesamiento ante un fallo transitorio de red (estado failed)', () => {
        const fp = getRecoveryFingerprint({ code: 'pkce_network_glitch_456' })!;

        markPayloadInFlight(fp);
        expect(canProcessPayload(fp)).toBe(false);

        // Ocurre fallo transitorio de red
        markPayloadFailed(fp);
        expect(getPayloadStatus(fp)).toBe('failed');

        // El usuario puede reintentar sin quedar bloqueado permanentemente
        expect(canProcessPayload(fp)).toBe(true);
        const retryAcquired = markPayloadInFlight(fp);
        expect(retryAcquired).toBe(true);
      });

      it('bloquea permanentemente reintentos tras un canje exitoso (estado success)', () => {
        const fp = getRecoveryFingerprint({ code: 'pkce_consumed_789' })!;

        markPayloadInFlight(fp);
        markPayloadSuccess(fp);

        expect(getPayloadStatus(fp)).toBe('success');
        expect(canProcessPayload(fp)).toBe(false);
        expect(markPayloadInFlight(fp)).toBe(false);
      });
    });
  });
});

