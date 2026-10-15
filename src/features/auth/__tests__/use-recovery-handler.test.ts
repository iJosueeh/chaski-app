import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  recoveryErrorMessage,
  resetRecoveryRuns,
  resolveRecoveryScreenPatch,
  runRecoveryHandling,
} from '../hooks/use-recovery-handler';
import {
  canProcessPayload,
  combineRecoveryParams,
  getPayloadStatus,
  getRecoveryFingerprint,
  hasRecoveryPayload,
  resetPayloadRegistry,
} from '../utils/recovery-link';
import type { ProcessRecoveryResult } from '../services/recovery.service';

vi.mock('expo-linking', () => ({
  createURL: vi.fn((path: string) => `chaski://${path.replace(/^\//, '')}`),
  useURL: vi.fn(() => null),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: {} },
}));

type RunOptions = Parameters<typeof runRecoveryHandling>[0];

function makeOptions(overrides?: Partial<RunOptions>): RunOptions {
  return {
    params: { code: 'pkce_code_123' },
    session: null,
    isPasswordRecovery: false,
    isRecoveryVerified: false,
    isVerified: false,
    setIsPasswordRecovery: vi.fn(),
    setIsRecoveryVerified: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    processRecoveryLink: vi.fn().mockResolvedValue({ success: true }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onStartingExchange: vi.fn(),
    ...overrides,
  };
}

const CODE_FINGERPRINT = getRecoveryFingerprint({ code: 'pkce_code_123' })!;

beforeEach(() => {
  resetPayloadRegistry();
  resetRecoveryRuns();
  vi.clearAllMocks();
});

describe('use-recovery-handler — casos de autorización', () => {
  it('Caso A con sesión explícita: verificado sin canjear el enlace', async () => {
    const session = { access_token: 'tok', user: { id: 'u1' } } as never;
    const opts = makeOptions({ session, isRecoveryVerified: true });

    const outcome = await runRecoveryHandling(opts);

    expect(outcome).toEqual({ status: 'verified' });
    expect(opts.setIsPasswordRecovery).toHaveBeenCalledWith(true);
    expect(opts.getSession).not.toHaveBeenCalled();
    expect(opts.processRecoveryLink).not.toHaveBeenCalled();
    expect(opts.onStartingExchange).not.toHaveBeenCalled();
    expect(resolveRecoveryScreenPatch(outcome)).toEqual({
      processing: false,
      isVerified: true,
      error: '',
    });
  });

  it('Caso A sin sesión en React: la resuelve con getSession()', async () => {
    const storedSession = { access_token: 'tok', user: { id: 'u1' } } as never;
    const opts = makeOptions({
      isRecoveryVerified: true,
      getSession: vi.fn().mockResolvedValue({ data: { session: storedSession } }),
    });

    const outcome = await runRecoveryHandling(opts);

    expect(outcome).toEqual({ status: 'verified' });
    expect(opts.getSession).toHaveBeenCalledTimes(1);
    expect(opts.processRecoveryLink).not.toHaveBeenCalled();
  });

  it('Caso B (ya verificado en este ciclo): no reprocesa y solo cierra el spinner', async () => {
    const opts = makeOptions({ isPasswordRecovery: true, isVerified: true });

    const outcome = await runRecoveryHandling(opts);

    expect(outcome).toEqual({ status: 'skipped', reason: 'already-processed' });
    expect(opts.processRecoveryLink).not.toHaveBeenCalled();
    expect(opts.onStartingExchange).not.toHaveBeenCalled();
    expect(resolveRecoveryScreenPatch(outcome)).toEqual({ processing: false });
  });

  it('sin carga útil y sin verificación previa: error «no-payload» con su copy exacto', async () => {
    const opts = makeOptions({ params: {} });

    const outcome = await runRecoveryHandling(opts);

    expect(outcome).toEqual({ status: 'error', kind: 'no-payload', detail: null });
    expect(opts.setIsPasswordRecovery).toHaveBeenCalledWith(false);
    expect(opts.setIsRecoveryVerified).toHaveBeenCalledWith(false);
    expect(opts.processRecoveryLink).not.toHaveBeenCalled();
    expect(resolveRecoveryScreenPatch(outcome)).toEqual({
      processing: false,
      isVerified: false,
      error:
        'No se detectó un enlace de recuperación válido. Para restablecer tu contraseña, solicita un nuevo enlace.',
    });
  });
});

describe('use-recovery-handler — canje de enlaces (éxito y error)', () => {
  it('canje PKCE exitoso: registra la huella, activa banderas y notifica el inicio', async () => {
    const opts = makeOptions();

    const outcome = await runRecoveryHandling(opts);

    expect(outcome).toEqual({ status: 'verified' });
    expect(opts.onStartingExchange).toHaveBeenCalledTimes(1);
    expect(opts.getSession).not.toHaveBeenCalled(); // sin flags no consulta sesión
    expect(opts.processRecoveryLink).toHaveBeenCalledTimes(1);
    expect(opts.processRecoveryLink).toHaveBeenCalledWith({ code: 'pkce_code_123' });
    expect(opts.setIsPasswordRecovery).toHaveBeenCalledWith(true); // pre-flight
    expect(opts.setIsRecoveryVerified).toHaveBeenCalledWith(true);
    expect(getPayloadStatus(CODE_FINGERPRINT)).toBe('success');
    expect(resolveRecoveryScreenPatch(outcome)).toEqual({
      processing: false,
      isVerified: true,
      error: '',
    });
  });

  it('canje rechazado: cierra sesión, desactiva banderas y marca la huella como fallida', async () => {
    const opts = makeOptions({
      processRecoveryLink: vi.fn().mockResolvedValue({ success: false, error: 'Código expirado' }),
    });

    const outcome = await runRecoveryHandling(opts);

    expect(outcome).toEqual({ status: 'error', kind: 'link-failed', detail: 'Código expirado' });
    expect(opts.signOut).toHaveBeenCalledTimes(1);
    expect(opts.setIsPasswordRecovery).toHaveBeenCalledWith(false);
    expect(opts.setIsRecoveryVerified).toHaveBeenCalledWith(false);
    expect(getPayloadStatus(CODE_FINGERPRINT)).toBe('failed');
    // Una huella fallida vuelve a ser procesable (tolerancia a fallos transitorios)
    expect(canProcessPayload(CODE_FINGERPRINT)).toBe(true);
    expect(resolveRecoveryScreenPatch(outcome)).toEqual({
      processing: false,
      isVerified: false,
      error: 'Código expirado',
    });
  });

  it('excepción en el canje: clasifica «exception» con el mensaje y cierra sesión', async () => {
    const opts = makeOptions({
      processRecoveryLink: vi.fn().mockRejectedValue(new Error('sin conexión')),
    });

    const outcome = await runRecoveryHandling(opts);

    expect(outcome).toEqual({ status: 'error', kind: 'exception', detail: 'sin conexión' });
    expect(opts.signOut).toHaveBeenCalledTimes(1);
    expect(resolveRecoveryScreenPatch(outcome)).toEqual({
      processing: false,
      isVerified: false,
      error: 'sin conexión',
    });
  });

  it('el detalle vacío cae a los textos de respaldo históricos', () => {
    expect(
      recoveryErrorMessage({ kind: 'link-failed', detail: null }),
    ).toBe('El enlace de recuperación es inválido, ha expirado o ya ha sido utilizado.');
    expect(
      recoveryErrorMessage({ kind: 'exception', detail: null }),
    ).toBe('Error al procesar el enlace de recuperación. Comprueba tu conexión e intenta nuevamente.');
    expect(recoveryErrorMessage({ kind: 'no-payload', detail: null })).toBe(
      'No se detectó un enlace de recuperación válido. Para restablecer tu contraseña, solicita un nuevo enlace.',
    );
    expect(recoveryErrorMessage({ kind: 'exception', detail: 'Detalle real' })).toBe('Detalle real');
  });
});

describe('use-recovery-handler — protección frente a enlaces duplicados', () => {
  it('dos ejecuciones concurrentes con la misma huella canjean UNA sola vez', async () => {
    let release!: (value: ProcessRecoveryResult) => void;
    const exchange = vi.fn(
      () =>
        new Promise<ProcessRecoveryResult>((resolve) => {
          release = resolve;
        }),
    );

    const first = makeOptions({ processRecoveryLink: exchange });
    const second = makeOptions({ processRecoveryLink: exchange });

    const p1 = runRecoveryHandling(first);
    const p2 = runRecoveryHandling(second);

    // El canje se dispara en la primera ejecución; la segunda debe reutilizarlo.
    await vi.waitFor(() => expect(exchange).toHaveBeenCalledTimes(1));

    release({ success: true });
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(exchange).toHaveBeenCalledTimes(1);
    expect(r1).toEqual({ status: 'verified' });
    expect(r2).toEqual({ status: 'verified' });
    // Solo la ejecución que inició el canje toca banderas/estado de proceso
    expect(second.setIsRecoveryVerified).not.toHaveBeenCalled();
    expect(second.onStartingExchange).toHaveBeenCalledTimes(1);
    expect(getPayloadStatus(CODE_FINGERPRINT)).toBe('success');
  });

  it('un enlace ya canjeadado no se vuelve a consumir (y la pantalla no queda sin resolver)', async () => {
    // Primer canje exitoso (simula una ejecución previa de la app).
    await runRecoveryHandling(makeOptions());
    expect(getPayloadStatus(CODE_FINGERPRINT)).toBe('success');

    // Reintento con las banderas ya apagadas (p. ej. tras cerrar sesión):
    // el enlace está consumido y no debe llamarse a Supabase de nuevo.
    const retry = makeOptions();
    const outcome = await runRecoveryHandling(retry);

    expect(retry.processRecoveryLink).not.toHaveBeenCalled();
    expect(retry.onStartingExchange).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'error', kind: 'link-failed', detail: null });
    // Existe un parche de pantalla (no un retorno silencioso): no queda en spinner.
    expect(resolveRecoveryScreenPatch(outcome)).toEqual({
      processing: false,
      isVerified: false,
      error: 'El enlace de recuperación es inválido, ha expirado o ya ha sido utilizado.',
    });
  });

  it('resetRecoveryRuns y resetPayloadRegistry aislan las pruebas', async () => {
    await runRecoveryHandling(makeOptions());
    expect(getPayloadStatus(CODE_FINGERPRINT)).toBe('success');

    resetPayloadRegistry();
    resetRecoveryRuns();

    expect(getPayloadStatus(CODE_FINGERPRINT)).toBeNull();
    const fresh = makeOptions();
    await runRecoveryHandling(fresh);
    expect(fresh.processRecoveryLink).toHaveBeenCalledTimes(1);
  });
});

describe('use-recovery-handler — combineRecoveryParams (parseo de enlaces)', () => {
  it('da prioridad a la URL sobre los parámetros de ruta', () => {
    const combined = combineRecoveryParams(
      { code: 'desde_url' },
      { code: 'desde_ruta', token_hash: 'hash_ruta' },
    );

    expect(combined.code).toBe('desde_url');
    expect(combined.tokenHash).toBe('hash_ruta');
  });

  it('completa desde la ruta cuando la URL no trae ese parámetro', () => {
    const combined = combineRecoveryParams(
      { accessToken: 'a', refreshToken: 'b' },
      { type: 'recovery', error: 'access_denied', error_description: 'Denegado' },
    );

    expect(combined.type).toBe('recovery');
    expect(combined.error).toBe('access_denied');
    expect(combined.errorDescription).toBe('Denegado');
    expect(combined.accessToken).toBe('a');
    expect(combined.refreshToken).toBe('b');
    expect(hasRecoveryPayload(combined)).toBe(true);
  });

  it('sin parámetros no produce carga útil', () => {
    const combined = combineRecoveryParams({}, {});
    expect(combined).toEqual({
      code: undefined,
      tokenHash: undefined,
      type: undefined,
      accessToken: undefined,
      refreshToken: undefined,
      error: undefined,
      errorDescription: undefined,
    });
    expect(hasRecoveryPayload(combined)).toBe(false);
  });
});
