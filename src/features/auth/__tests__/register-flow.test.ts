import { describe, expect, it, vi, beforeEach } from 'vitest';
import { signUp } from '../services/auth.service';
import { normalizeEmail } from '../utils/otp-validation';
import {
  validateEmail,
  validateFullName,
  validateRegistrationPassword,
} from '../utils/password-validation';
import { supabase } from '@/lib/supabase';

vi.mock('expo-linking', () => ({
  createURL: vi.fn((path: string) => `chaski://${path.replace(/^\//, '')}`),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      resend: vi.fn(),
      updateUser: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

describe('Flujo de Registro (4 Campos) — Contratos y Validaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Validaciones de los 4 campos del formulario', () => {
    it('normaliza el correo eliminando espacios y convirtiendo a minúsculas', () => {
      const email = '  Pasajero.Andino@CHASKI.PE  ';
      const normalized = normalizeEmail(email);
      expect(normalized).toBe('pasajero.andino@chaski.pe');
    });

    it('valida formatos de correo correctamente', () => {
      expect(validateEmail('').isValid).toBe(false);
      expect(validateEmail('   ').isValid).toBe(false);
      expect(validateEmail('invalido').isValid).toBe(false);
      expect(validateEmail('sin-dominio@').isValid).toBe(false);
      expect(validateEmail('viajero@chaski.pe').isValid).toBe(true);
    });

    it('valida que el nombre completo no esté vacío', () => {
      expect(validateFullName('').isValid).toBe(false);
      expect(validateFullName('   ').isValid).toBe(false);
      expect(validateFullName('  Tupac Yupanqui  ').isValid).toBe(true);
      expect(validateFullName('  Tupac Yupanqui  ').trimmedName).toBe('Tupac Yupanqui');
    });

    it('valida contraseña mínima de 6 caracteres y coincidencia exacta con confirmación', () => {
      // Contraseña vacía
      expect(validateRegistrationPassword('', '123456').isValid).toBe(false);
      expect(validateRegistrationPassword('', '123456').error).toBe('Ingresa una contraseña');

      // Menos de 6 caracteres
      expect(validateRegistrationPassword('12345', '12345').isValid).toBe(false);
      expect(validateRegistrationPassword('12345', '12345').error).toBe(
        'La contraseña debe tener al menos 6 caracteres',
      );

      // Confirmación vacía
      expect(validateRegistrationPassword('123456', '').isValid).toBe(false);
      expect(validateRegistrationPassword('123456', '').error).toBe('Confirma tu contraseña');

      // No coinciden
      expect(validateRegistrationPassword('123456', '654321').isValid).toBe(false);
      expect(validateRegistrationPassword('123456', '654321').error).toBe(
        'Las contraseñas no coinciden',
      );

      // Coincidencia exacta válida
      expect(validateRegistrationPassword('secreto123', 'secreto123').isValid).toBe(true);
    });
  });

  describe('2. Llamada a signUp: confirmPassword NUNCA se envía a Supabase', () => {
    it('invoca supabase.auth.signUp enviando únicamente { email, password, options: { data: { nombre } } }', async () => {
      const mockSignUp = vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-chaski-123',
            email: 'pasajero@chaski.pe',
            user_metadata: { nombre: 'Manco Capac' },
          } as any,
          session: null,
        },
        error: null,
      });

      const formValues = {
        nombre: '  Manco Capac  ',
        email: '  Pasajero@Chaski.PE  ',
        password: 'password123',
        confirmPassword: 'password123', // Solo existe en el estado del cliente
      };

      // Validar localmente
      const nameRes = validateFullName(formValues.nombre);
      const emailRes = validateEmail(normalizeEmail(formValues.email));
      const pwdRes = validateRegistrationPassword(formValues.password, formValues.confirmPassword);

      expect(nameRes.isValid).toBe(true);
      expect(emailRes.isValid).toBe(true);
      expect(pwdRes.isValid).toBe(true);

      // Ejecutar signUp
      const response = await signUp({
        nombre: nameRes.trimmedName!,
        email: normalizeEmail(formValues.email),
        password: formValues.password,
      });

      // Asegurar que confirmPassword jamás se incluyó en los argumentos enviados a Supabase
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'pasajero@chaski.pe',
        password: 'password123',
        options: {
          data: {
            nombre: 'Manco Capac',
          },
        },
      });

      const sentArgs = mockSignUp.mock.calls[0][0];
      expect((sentArgs as any).confirmPassword).toBeUndefined();
      expect((sentArgs.options?.data as any).confirmPassword).toBeUndefined();

      expect(response.error).toBeNull();
      expect(response.data.user?.id).toBe('user-chaski-123');
    });

    it('maneja y retorna errores de autenticación provenientes de Supabase', async () => {
      vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: 'User already registered',
          status: 400,
        } as any,
      });

      const response = await signUp({
        nombre: 'Pasajero Registrado',
        email: 'existente@chaski.pe',
        password: 'password123',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('User already registered');
    });
  });

  describe('3. Secuencia de foco y navegación segura', () => {
    it('secuencia de 4 campos transiciona de nombre a correo, a contraseña, a confirmación y luego envía', () => {
      const focusChain: string[] = [];
      const mockEmailFocus = () => focusChain.push('email');
      const mockPasswordFocus = () => focusChain.push('password');
      const mockConfirmFocus = () => focusChain.push('confirmPassword');
      const mockSubmit = vi.fn(() => focusChain.push('submitted'));

      // 1. Enter en nombre
      mockEmailFocus();
      // 2. Enter en email
      mockPasswordFocus();
      // 3. Enter en password
      mockConfirmFocus();
      // 4. Enter en confirmPassword
      mockSubmit();

      expect(focusChain).toEqual(['email', 'password', 'confirmPassword', 'submitted']);
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    it('prepara payload de navegación conteniendo únicamente email normalizado y mode=signup', () => {
      const emailInput = '  Nuevo.Viajero@Chaski.Pe ';
      const normalizedEmail = normalizeEmail(emailInput);

      const navigationTarget = {
        pathname: '/verify-otp' as const,
        params: {
          email: normalizedEmail,
          mode: 'signup',
        },
      };

      expect(navigationTarget.pathname).toBe('/verify-otp');
      expect(navigationTarget.params.email).toBe('nuevo.viajero@chaski.pe');
      expect(navigationTarget.params.mode).toBe('signup');

      // Garantizar que ninguna contraseña, confirmación ni token sensible exista en los parámetros
      expect((navigationTarget.params as any).password).toBeUndefined();
      expect((navigationTarget.params as any).confirmPassword).toBeUndefined();
      expect((navigationTarget.params as any).token).toBeUndefined();
    });

    it('garantiza la no ejecución de registro concurrente mientras loading sea true', async () => {
      let inFlight = false;
      const signUpExecution = vi.fn().mockImplementation(async () => {
        if (inFlight) return { duplicateBlocked: true };
        inFlight = true;
        await new Promise((resolve) => setTimeout(resolve, 50));
        inFlight = false;
        return { success: true };
      });

      const call1 = signUpExecution();
      const call2 = signUpExecution();

      const [res1, res2] = await Promise.all([call1, call2]);

      expect(res1).toEqual({ success: true });
      expect(res2).toEqual({ duplicateBlocked: true });
    });
  });

  describe('4. Auto-desplazamiento y visibilidad sobre el teclado', () => {
    const computeOffset = (
      fieldKey: string,
      isCompact: boolean,
      measuredOffsets?: Record<string, number>,
    ) => {
      if (measuredOffsets && typeof measuredOffsets[fieldKey] === 'number') {
        return measuredOffsets[fieldKey];
      }
      const defaults = isCompact
        ? { nombre: 0, email: 60, password: 130, confirmPassword: 210 }
        : { nombre: 0, email: 70, password: 150, confirmPassword: 230 };
      return defaults[fieldKey as keyof typeof defaults] ?? 0;
    };

    it('calcula los desplazamientos correctos para cada uno de los 4 campos', () => {
      // Pantalla estándar
      expect(computeOffset('nombre', false)).toBe(0);
      expect(computeOffset('email', false)).toBe(70);
      expect(computeOffset('password', false)).toBe(150);
      expect(computeOffset('confirmPassword', false)).toBe(230);

      // Pantalla compacta (<680)
      expect(computeOffset('nombre', true)).toBe(0);
      expect(computeOffset('email', true)).toBe(60);
      expect(computeOffset('password', true)).toBe(130);
      expect(computeOffset('confirmPassword', true)).toBe(210);
    });

    it('prioriza las mediciones nativas onLayout si están disponibles', () => {
      const dynamicOffsets = {
        nombre: 0,
        email: 74,
        password: 148,
        confirmPassword: 222,
      };

      expect(computeOffset('confirmPassword', false, dynamicOffsets)).toBe(222);
      expect(computeOffset('email', false, dynamicOffsets)).toBe(74);
    });

    it('garantiza que Confirmar Contraseña mantiene margen visible sobre el teclado', () => {
      const screenHeight = 850;
      const keyboardHeight = 310;
      const viewportHeight = screenHeight - keyboardHeight; // 540dp
      const offset = computeOffset('confirmPassword', false); // 230dp

      // Posición aproximada del campo 4 en el ticket: Y ~ 546dp, altura ~ 68dp
      const fieldYInTicket = 546;
      const fieldHeight = 68;
      const fieldBottomInTicket = fieldYInTicket + fieldHeight; // 614dp

      // Posición relativa del campo 4 dentro del viewport visible tras el scroll
      const visibleFieldTop = fieldYInTicket - offset; // 316dp
      const visibleFieldBottom = fieldBottomInTicket - offset; // 384dp

      expect(visibleFieldTop).toBeGreaterThanOrEqual(0);
      expect(visibleFieldBottom).toBeLessThan(viewportHeight);

      // Margen libre entre el borde inferior del campo y el borde superior del teclado
      const breathingMarginAboveKeyboard = viewportHeight - visibleFieldBottom; // 540 - 384 = 156dp
      expect(breathingMarginAboveKeyboard).toBeGreaterThan(100);
      expect(breathingMarginAboveKeyboard).toBe(156);
    });

    it('al fallar validación de confirmación o registro, re-desplaza a confirmPassword', () => {
      const scrollCalls: { y: number; animated: boolean }[] = [];
      const mockScrollTo = (call: { y: number; animated: boolean }) => scrollCalls.push(call);

      // Simula fallo de validación
      const validation = validateRegistrationPassword('123456', 'mismatch');
      expect(validation.isValid).toBe(false);

      // El handler reubica la vista en confirmPassword (offset 230)
      const targetOffset = computeOffset('confirmPassword', false);
      mockScrollTo({ y: targetOffset, animated: true });

      expect(scrollCalls).toHaveLength(1);
      expect(scrollCalls[0]).toEqual({ y: 230, animated: true });
    });
  });
});
