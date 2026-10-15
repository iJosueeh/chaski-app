import { describe, expect, it, vi } from 'vitest';

import { LOGIN_UNEXPECTED_ERROR, runLogin } from '../hooks/use-login';

vi.mock('expo-linking', () => ({
  createURL: vi.fn((path: string) => `chaski://${path.replace(/^\//, '')}`),
  useURL: vi.fn(() => null),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: {} },
}));

function makeOptions(overrides?: Partial<Parameters<typeof runLogin>[0]>) {
  return {
    email: 'viajero@chaski.pe',
    password: 'secreta123',
    busy: false,
    onStarting: vi.fn(() => {}),
    setIsPasswordRecovery: vi.fn(),
    setIsRecoveryVerified: vi.fn(),
    signIn: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe('use-login — runLogin: validación de campos', () => {
  it('campos vacíos: errores en ambos campos, sin llamar a Supabase ni activar loading', async () => {
    const opts = makeOptions({ email: '', password: '' });

    const outcome = await runLogin(opts);

    expect(outcome).toEqual({
      status: 'error',
      kind: 'validation',
      emailError: 'Ingresa tu correo electrónico',
      passwordError: 'Ingresa tu contraseña',
      field: 'email',
    });
    expect(opts.signIn).not.toHaveBeenCalled();
    expect(opts.onStarting).not.toHaveBeenCalled();
    expect(opts.setIsPasswordRecovery).not.toHaveBeenCalled();
  });

  it('solo falta la contraseña: mensaje bajo el campo de contraseña', async () => {
    const opts = makeOptions({ password: '' });

    const outcome = await runLogin(opts);

    expect(outcome).toEqual({
      status: 'error',
      kind: 'validation',
      emailError: undefined,
      passwordError: 'Ingresa tu contraseña',
      field: 'password',
    });
    expect(opts.signIn).not.toHaveBeenCalled();
  });

  it('solo falta el correo: mensaje bajo el campo de correo y foco al correo', async () => {
    const opts = makeOptions({ email: '   ', password: 'secreta123' });

    const outcome = await runLogin(opts);

    expect(outcome).toEqual({
      status: 'error',
      kind: 'validation',
      emailError: 'Ingresa tu correo electrónico',
      passwordError: undefined,
      field: 'email',
    });
    expect(opts.signIn).not.toHaveBeenCalled();
  });

  it('correo sin @ o sin dominio: rechaza con el mensaje de formato y sin llamar a Supabase', async () => {
    for (const invalidEmail of ['viajero', 'viajero@chaski', '@chaski.pe', 'viajero@.pe']) {
      const opts = makeOptions({ email: invalidEmail });

      const outcome = await runLogin(opts);

      expect(outcome).toMatchObject({
        status: 'error',
        kind: 'validation',
        emailError: 'Ingresa un formato de correo válido',
        field: 'email',
      });
      expect(opts.signIn).not.toHaveBeenCalled();
    }
  });
});

describe('use-login — runLogin: envío y normalización', () => {
  it('envío válido: envía el correo normalizado y la contraseña sin modificar', async () => {
    const opts = makeOptions({ email: '  Viajero@Chaski.pe  ', password: '  secreta con espacios  ' });

    const outcome = await runLogin(opts);

    expect(outcome).toEqual({ status: 'success' });
    expect(opts.signIn).toHaveBeenCalledTimes(1);
    expect(opts.signIn).toHaveBeenCalledWith({
      email: 'viajero@chaski.pe',
      password: '  secreta con espacios  ',
    });
    expect(opts.onStarting).toHaveBeenCalledTimes(1);
    expect(opts.setIsPasswordRecovery).toHaveBeenCalledWith(false);
    expect(opts.setIsRecoveryVerified).toHaveBeenCalledWith(false);
  });

  it('envíos duplicados: con una petición en vuelo devuelve «ignored» sin tocar estados', async () => {
    const opts = makeOptions({ busy: true });

    const outcome = await runLogin(opts);

    expect(outcome).toEqual({ status: 'ignored' });
    expect(opts.signIn).not.toHaveBeenCalled();
    expect(opts.onStarting).not.toHaveBeenCalled();
    expect(opts.setIsPasswordRecovery).not.toHaveBeenCalled();
    expect(opts.setIsRecoveryVerified).not.toHaveBeenCalled();
  });
});

describe('use-login — runLogin: errores del servidor', () => {
  it('credenciales incorrectas: mensaje genérico sin revelar cuál campo falló', async () => {
    const opts = makeOptions({
      signIn: vi.fn().mockResolvedValue({
        error: { message: 'Invalid login credentials', status: 400 },
      }),
    });

    const outcome = await runLogin(opts);

    expect(outcome).toEqual({
      status: 'error',
      kind: 'server',
      message: 'Correo o contraseña incorrectos.',
      field: 'password',
    });
  });

  it('error de red devuelto por Supabase: mensaje de conexión distinto al de credenciales', async () => {
    const opts = makeOptions({
      signIn: vi.fn().mockResolvedValue({
        error: { message: 'Network request failed' },
      }),
    });

    const outcome = await runLogin(opts);

    expect(outcome).toEqual({
      status: 'error',
      kind: 'server',
      message: 'Error de conexión con el servidor. Verifica tu conexión a internet.',
      field: 'password',
    });
  });

  it('excepción de red lanzada durante la petición: se clasifica como conexión', async () => {
    const opts = makeOptions({
      signIn: vi.fn().mockRejectedValue(new TypeError('Network request failed')),
    });

    const outcome = await runLogin(opts);

    expect(outcome).toEqual({
      status: 'error',
      kind: 'server',
      message: 'Error de conexión con el servidor. Verifica tu conexión a internet.',
      field: 'password',
    });
  });

  it('excepción sin mensaje: conserva el texto de respaldo histórico', async () => {
    const opts = makeOptions({
      signIn: vi.fn().mockRejectedValue(null),
    });

    const outcome = await runLogin(opts);

    expect(outcome).toEqual({
      status: 'error',
      kind: 'server',
      message: LOGIN_UNEXPECTED_ERROR,
      field: 'password',
    });
  });

  it('excepción con mensaje desconocido: conserva el mensaje original (comportamiento histórico)', async () => {
    const opts = makeOptions({
      signIn: vi.fn().mockRejectedValue(new Error('Fallo interno del proveedor')),
    });

    const outcome = await runLogin(opts);

    expect(outcome).toEqual({
      status: 'error',
      kind: 'server',
      message: 'Fallo interno del proveedor',
      field: 'password',
    });
  });
});
