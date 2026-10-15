import { describe, expect, it } from 'vitest';
import {
  validateEmail,
  validateLoginFields,
  validatePasswordChange,
  validateRegistrationPassword,
  validateFullName,
} from '../utils/password-validation';

describe('Validación del formulario de inicio de sesión (validateLoginFields)', () => {
  it('aprueba credenciales con correo válido y devuelve el correo normalizado', () => {
    const result = validateLoginFields('  Viajero@Chaski.pe  ', 'secreta123');
    expect(result.isValid).toBe(true);
    expect(result.normalizedEmail).toBe('viajero@chaski.pe');
    expect(result.emailError).toBeUndefined();
    expect(result.passwordError).toBeUndefined();
  });

  it('rechaza ambos campos vacíos con mensajes por campo', () => {
    const result = validateLoginFields('', '');
    expect(result.isValid).toBe(false);
    expect(result.emailError).toBe('Ingresa tu correo electrónico');
    expect(result.passwordError).toBe('Ingresa tu contraseña');
  });

  it('rechaza correo con espacios internos como formato inválido', () => {
    const result = validateLoginFields('viajo ro@chaski.pe', 'secreta123');
    expect(result.isValid).toBe(false);
    expect(result.emailError).toBe('Ingresa un formato de correo válido');
  });

  it('rechaza correos sin @ o sin dominio (reutiliza validateEmail)', () => {
    expect(validateLoginFields('viajero', 'secreta').emailError).toBe(
      'Ingresa un formato de correo válido',
    );
    expect(validateLoginFields('viajero@chaski', 'secreta').emailError).toBe(
      'Ingresa un formato de correo válido',
    );
  });

  it('rechaza contraseña vacía con correo válido', () => {
    const result = validateLoginFields('viajero@chaski.pe', '');
    expect(result.isValid).toBe(false);
    expect(result.emailError).toBeUndefined();
    expect(result.passwordError).toBe('Ingresa tu contraseña');
  });
});

describe('Validaciones de Cambio de Contraseña (Supabase Auth)', () => {
  it('aprueba contraseñas válidas que coinciden y tienen al menos 6 caracteres', () => {
    const result = validatePasswordChange('claveSegura123', 'claveSegura123');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('aprueba contraseñas exactas de 6 caracteres', () => {
    const result = validatePasswordChange('123456', '123456');
    expect(result.isValid).toBe(true);
  });

  it('rechaza contraseñas vacías o de sólo espacios en blanco', () => {
    const r1 = validatePasswordChange('', '123456');
    expect(r1.isValid).toBe(false);
    expect(r1.error).toBe('Ingresa la nueva contraseña');

    const r2 = validatePasswordChange('   ', '   ');
    expect(r2.isValid).toBe(false);
    expect(r2.error).toBe('Ingresa la nueva contraseña');
  });

  it('rechaza contraseñas con menos de 6 caracteres (estándar de seguridad Supabase)', () => {
    const result = validatePasswordChange('abc12', 'abc12');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('La contraseña debe tener al menos 6 caracteres');
  });

  it('rechaza cuando la confirmación está vacía', () => {
    const result = validatePasswordChange('claveValida123', '');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Confirma la nueva contraseña');
  });

  it('rechaza cuando la confirmación no coincide con la nueva contraseña', () => {
    const result = validatePasswordChange('claveValida123', 'otraClaveDistinta');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Las contraseñas no coinciden');
  });

  it('es sensible a mayúsculas y minúsculas en la confirmación', () => {
    const result = validatePasswordChange('MiClave123', 'miclave123');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Las contraseñas no coinciden');
  });
});

describe('Validaciones de Registro de Contraseña (4 Campos)', () => {
  it('aprueba cuando la contraseña y la confirmación coinciden y tienen >= 6 caracteres', () => {
    const result = validateRegistrationPassword('viajero2026', 'viajero2026');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rechaza contraseña vacía o con sólo espacios', () => {
    const r1 = validateRegistrationPassword('', 'viajero2026');
    expect(r1.isValid).toBe(false);
    expect(r1.error).toBe('Ingresa una contraseña');

    const r2 = validateRegistrationPassword('   ', 'viajero2026');
    expect(r2.isValid).toBe(false);
    expect(r2.error).toBe('Ingresa una contraseña');
  });

  it('rechaza contraseña con menos de 6 caracteres', () => {
    const result = validateRegistrationPassword('12345', '12345');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('La contraseña debe tener al menos 6 caracteres');
  });

  it('rechaza confirmación vacía obligatoria', () => {
    const result = validateRegistrationPassword('viajero2026', '');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Confirma tu contraseña');
  });

  it('rechaza cuando la contraseña y confirmación no coinciden exactamente', () => {
    const result = validateRegistrationPassword('viajero2026', 'viajero2027');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Las contraseñas no coinciden');
  });
});

describe('Validaciones de Nombre Completo', () => {
  it('aprueba nombres válidos y devuelve el nombre recortado', () => {
    const result = validateFullName('  Tupac Amaru  ');
    expect(result.isValid).toBe(true);
    expect(result.trimmedName).toBe('Tupac Amaru');
  });

  it('rechaza nombres vacíos o sólo de espacios', () => {
    expect(validateFullName('').isValid).toBe(false);
    expect(validateFullName('').error).toBe('Ingresa tu nombre completo');
    expect(validateFullName('   ').isValid).toBe(false);
    expect(validateFullName('   ').error).toBe('Ingresa tu nombre completo');
  });
});

describe('Validaciones de Correo para Autenticación', () => {
  it('aprueba direcciones de correo con formato válido', () => {
    expect(validateEmail('turista@chaski.pe').isValid).toBe(true);
    expect(validateEmail('nombre.apellido@dominio.com').isValid).toBe(true);
    expect(validateEmail('usuario+tag@gmail.com').isValid).toBe(true);
  });

  it('rechaza correos vacíos o sólo espacios en blanco', () => {
    const r1 = validateEmail('');
    expect(r1.isValid).toBe(false);
    expect(r1.error).toBe('Ingresa tu correo electrónico');

    const r2 = validateEmail('   ');
    expect(r2.isValid).toBe(false);
    expect(r2.error).toBe('Ingresa tu correo electrónico');
  });

  it('rechaza correos sin arroba o sin dominio válido', () => {
    const r1 = validateEmail('correosinat.com');
    expect(r1.isValid).toBe(false);
    expect(r1.error).toBe('Ingresa un formato de correo válido');

    const r2 = validateEmail('usuario@');
    expect(r2.isValid).toBe(false);
    expect(r2.error).toBe('Ingresa un formato de correo válido');

    const r3 = validateEmail('@dominio.com');
    expect(r3.isValid).toBe(false);
    expect(r3.error).toBe('Ingresa un formato de correo válido');

    const r4 = validateEmail('usuario@dominio');
    expect(r4.isValid).toBe(false);
    expect(r4.error).toBe('Ingresa un formato de correo válido');
  });
});
