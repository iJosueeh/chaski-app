import { describe, expect, it } from 'vitest';
import { validateEmail, validatePasswordChange } from '../utils/password-validation';

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

describe('Validaciones de Correo para Recuperación de Contraseña', () => {
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
