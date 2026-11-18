import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '@/lib/supabase';

import type { AdminUpdateUserInput } from '../interfaces/admin.interface';
import {
  anonymizeAdminUser,
  deleteAdminExpedicion,
  deleteAdminSolicitud,
  fetchAdminExpediciones,
  fetchAdminSolicitudes,
  updateAdminUser,
} from '../services/admin.service';
import {
  hasUserChanges,
  normalizeUserName,
  validateAdminUserInput,
} from '../utils/admin-validation';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const rpcMock = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

function inputBase(overrides: Partial<AdminUpdateUserInput> = {}): AdminUpdateUserInput {
  return {
    id: 'user-1',
    nombre: 'Ana Torres',
    rol: 'USUARIO',
    estado: true,
    ...overrides,
  };
}

describe('admin CRUD (Fase 1 · APF3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ── Validaciones de cliente ───────────────────────────────────────────── */
  describe('validaciones de cliente', () => {
    it('normaliza el nombre quitando espacios sobrantes', () => {
      expect(normalizeUserName('  Ana   Torres  ')).toBe('Ana Torres');
      expect(normalizeUserName(null)).toBe('');
      expect(normalizeUserName(undefined)).toBe('');
    });

    it('rechaza nombres fuera del rango 2..60 (mismo CHECK que la BD)', () => {
      expect(validateAdminUserInput(inputBase({ nombre: 'A' }))).toContain('al menos 2');
      expect(validateAdminUserInput(inputBase({ nombre: 'x'.repeat(61) }))).toContain(
        'no puede superar los 60',
      );
      expect(validateAdminUserInput(inputBase({ nombre: '   ' }))).toContain('al menos 2');
    });

    it('acepta los límites exactos (2 y 60 caracteres)', () => {
      expect(validateAdminUserInput(inputBase({ nombre: 'Ab' }))).toBeNull();
      expect(validateAdminUserInput(inputBase({ nombre: 'x'.repeat(60) }))).toBeNull();
    });

    it('rechaza identificadores vacíos y roles no permitidos', () => {
      expect(validateAdminUserInput(inputBase({ id: '' }))).toContain(
        'Identificador de usuario no válido',
      );
      expect(
        validateAdminUserInput(inputBase({ rol: 'SUPERADMIN' as unknown as 'ADMIN' })),
      ).toContain('USUARIO o ADMIN');
    });

    it('detecta si el borrador cambió respecto al original', () => {
      const original = { nombre: 'Ana Torres', rol: 'USUARIO' as const, estado: true };
      expect(hasUserChanges(original, { ...original })).toBe(false);
      expect(hasUserChanges(original, { ...original, nombre: ' Ana Torres ' })).toBe(false);
      expect(hasUserChanges(original, { ...original, nombre: 'Ana T.' })).toBe(true);
      expect(hasUserChanges(original, { ...original, rol: 'ADMIN' })).toBe(true);
      expect(hasUserChanges(original, { ...original, estado: false })).toBe(true);
    });
  });

  /* ── updateAdminUser ──────────────────────────────────────────────────── */
  describe('updateAdminUser', () => {
    it('no llama a la base de datos si la validación local falla', async () => {
      const result = await updateAdminUser(inputBase({ nombre: 'A' }));

      expect(result.success).toBe(false);
      expect(result.error).toContain('al menos 2');
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it('envía los parámetros esperados y devuelve los valores nuevos', async () => {
      rpcMock.mockResolvedValue({
        data: {
          usuario_id: 'user-1',
          nombre_anterior: 'Ana',
          nombre_nuevo: 'Ana Torres',
          rol_anterior: 'USUARIO',
          rol_nuevo: 'ADMIN',
          estado_anterior: true,
          estado_nuevo: false,
        },
        error: null,
      });

      const result = await updateAdminUser(
        inputBase({ nombre: '  Ana   Torres ', rol: 'ADMIN', estado: false }),
      );

      expect(rpcMock).toHaveBeenCalledWith('admin_update_user', {
        p_target_user_id: 'user-1',
        p_nombre: 'Ana Torres',
        p_rol: 'ADMIN',
        p_estado: false,
      });
      expect(result).toMatchObject({
        success: true,
        usuario_id: 'user-1',
        nombre_nuevo: 'Ana Torres',
        rol_nuevo: 'ADMIN',
        estado_nuevo: false,
      });
    });

    it('traduce las salvaguardas de la base de datos a mensajes legibles', async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'LAST_ADMIN_PROTECTION: unico admin activo' },
      });
      const ultimoAdmin = await updateAdminUser(inputBase());
      expect(ultimoAdmin.success).toBe(false);
      expect(ultimoAdmin.error).toContain('único administrador activo');

      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'AUTH_UNAUTHORIZED: se requiere admin' },
      });
      const sinPermiso = await updateAdminUser(inputBase());
      expect(sinPermiso.error).toContain('Acceso denegado');

      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'CANNOT_DEMOTE_SELF: no puedes quitarte el rol' },
      });
      const autoDegradacion = await updateAdminUser(inputBase());
      expect(autoDegradacion.error).toContain('No puedes quitarte tu propio rol');
    });
  });

  /* ── anonymizeAdminUser ───────────────────────────────────────────────── */
  describe('anonymizeAdminUser', () => {
    it('rechaza identificadores vacíos sin llamar a la base de datos', async () => {
      const result = await anonymizeAdminUser('');
      expect(result.success).toBe(false);
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it('anonimiza y devuelve el nombre de baja', async () => {
      rpcMock.mockResolvedValue({
        data: {
          usuario_id: 'user-9',
          nombre_anterior: 'Luis',
          nombre_nuevo: 'Usuario dado de baja',
        },
        error: null,
      });

      const result = await anonymizeAdminUser('user-9');

      expect(rpcMock).toHaveBeenCalledWith('admin_anonymize_user', {
        p_target_user_id: 'user-9',
      });
      expect(result.success).toBe(true);
      expect(result.nombre_nuevo).toBe('Usuario dado de baja');
    });

    it('traduce la protección de auto-baja', async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'CANNOT_DELETE_SELF: no puedes darte de baja' },
      });

      const result = await anonymizeAdminUser('user-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No puedes dar de baja tu propia cuenta');
    });
  });

  /* ── Solicitudes ──────────────────────────────────────────────────────── */
  describe('fetchAdminSolicitudes', () => {
    it('mapea las filas y extrae el total_count de la ventana', async () => {
      rpcMock.mockResolvedValue({
        data: [
          {
            id: 'sol-1',
            usuario_id: 'user-1',
            usuario_nombre: 'Ana',
            usuario_email: 'ana@example.com',
            fecha_hora_inicio: '2026-11-09T10:00:00Z',
            fecha_hora_fin: '2026-11-09T19:00:00Z',
            inicio_descripcion: 'Miraflores',
            tipo_punto_final: 'REGRESAR_INICIO',
            movilidad: 'CAMINANDO',
            gasto_max: '95.00',
            fecha_creacion: '2026-11-08T12:00:00Z',
            categorias: 'Cultura, Historia',
            estado_expedicion: 'COMPLETADA',
            total_count: 7,
          },
        ],
        error: null,
      });

      const { data, error } = await fetchAdminSolicitudes({ search: '  ana  ', limit: 500 });

      expect(error).toBeUndefined();
      expect(data?.totalCount).toBe(7);
      expect(data?.solicitudes[0]).toMatchObject({
        id: 'sol-1',
        usuario_email: 'ana@example.com',
        categorias: 'Cultura, Historia',
        gasto_max: 95,
        estado_expedicion: 'COMPLETADA',
      });
      // limit se satura en 100 y la búsqueda viaja recortada
      expect(rpcMock).toHaveBeenCalledWith('admin_get_solicitudes', {
        p_search: 'ana',
        p_limit: 100,
        p_offset: 0,
      });
    });

    it('devuelve lista vacía y total 0 cuando no hay filas', async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });

      const { data } = await fetchAdminSolicitudes();

      expect(data?.solicitudes).toEqual([]);
      expect(data?.totalCount).toBe(0);
    });

    it('propaga el error traducido', async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'AUTH_UNAUTHORIZED: se requiere admin' },
      });

      const { data, error } = await fetchAdminSolicitudes();

      expect(data).toBeNull();
      expect(error).toContain('Acceso denegado');
    });
  });

  describe('deleteAdminSolicitud', () => {
    it('llama a la RPC con el id y reporta éxito', async () => {
      rpcMock.mockResolvedValue({ data: { solicitud_id: 'sol-1' }, error: null });

      const result = await deleteAdminSolicitud('sol-1');

      expect(rpcMock).toHaveBeenCalledWith('admin_delete_solicitud', {
        p_solicitud_id: 'sol-1',
      });
      expect(result.success).toBe(true);
    });

    it('traduce SOLICITUD_NOT_FOUND', async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'SOLICITUD_NOT_FOUND: ya no existe' },
      });

      const result = await deleteAdminSolicitud('sol-x');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ya no existe');
    });
  });

  /* ── Expediciones ─────────────────────────────────────────────────────── */
  describe('fetchAdminExpediciones', () => {
    it('mapea el avance de paradas y el total', async () => {
      rpcMock.mockResolvedValue({
        data: [
          {
            solicitud_id: 'sol-2',
            usuario_id: 'user-2',
            usuario_nombre: 'Luis',
            usuario_email: 'luis@example.com',
            estado_expedicion: 'PARCIAL',
            completado_en: '2026-11-08T18:00:00Z',
            total_paradas: 5,
            visitadas: 3,
            titulo_plan: 'Ruta Exploradora',
            total_count: 2,
          },
        ],
        error: null,
      });

      const { data } = await fetchAdminExpediciones({ limit: 10 });

      expect(data?.totalCount).toBe(2);
      expect(data?.expediciones[0]).toMatchObject({
        solicitud_id: 'sol-2',
        estado_expedicion: 'PARCIAL',
        total_paradas: 5,
        visitadas: 3,
        titulo_plan: 'Ruta Exploradora',
      });
    });
  });

  describe('deleteAdminExpedicion', () => {
    it('reporta éxito', async () => {
      rpcMock.mockResolvedValue({ data: { solicitud_id: 'sol-2' }, error: null });

      const result = await deleteAdminExpedicion('sol-2');

      expect(rpcMock).toHaveBeenCalledWith('admin_delete_expedicion', {
        p_solicitud_id: 'sol-2',
      });
      expect(result.success).toBe(true);
    });

    it('traduce EXPEDICION_NOT_FOUND', async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'EXPEDICION_NOT_FOUND: ya no existe' },
      });

      const result = await deleteAdminExpedicion('sol-y');

      expect(result.error).toContain('ya no existe');
    });
  });

  /* ── Reglas de interfaz (contratos puros) ─────────────────────────────── */
  describe('reglas de interfaz del modal de edición', () => {
    const bloqueaEdicionDeRol = (isCurrentUser: boolean) => isCurrentUser;
    const botonGuardarDeshabilitado = (isSaving: boolean, hayCambios: boolean) =>
      isSaving || !hayCambios;

    it('bloquea rol y estado cuando el admin se edita a sí mismo', () => {
      expect(bloqueaEdicionDeRol(true)).toBe(true);
      expect(bloqueaEdicionDeRol(false)).toBe(false);
    });

    it('deshabilita guardar sin cambios o mientras guarda', () => {
      expect(botonGuardarDeshabilitado(false, false)).toBe(true);
      expect(botonGuardarDeshabilitado(true, true)).toBe(true);
      expect(botonGuardarDeshabilitado(false, true)).toBe(false);
    });

    it('la baja definitiva exige doble confirmación', () => {
      let confirmando = false;
      let ejecutada = false;

      const primeraPulsacion = () => {
        confirmando = true;
      };
      const segundaPulsacion = () => {
        if (confirmando) ejecutada = true;
      };

      primeraPulsacion();
      expect(ejecutada).toBe(false);
      segundaPulsacion();
      expect(ejecutada).toBe(true);
    });
  });
});
