import { describe, expect, it } from 'vitest';
import type { UserProfileRecord, UserAccountStatus, UserRole } from '@/features/auth/interfaces/auth.interfaces';

/**
 * Función pura que replica fielmente la lógica de determinación de estado
 * de cuenta y privilegios administrativos implementada en AuthContext.
 */
function resolveAuthStatus({
  session,
  loading,
  profile,
  isNetworkError,
}: {
  session: any | null;
  loading: boolean;
  profile: UserProfileRecord | null;
  isNetworkError?: boolean;
}): {
  accountStatus: UserAccountStatus;
  userRole: UserRole;
  isAdmin: boolean;
  isAccountSuspended: boolean;
} {
  if (loading && !session) {
    return {
      accountStatus: 'cargando',
      userRole: 'USUARIO',
      isAdmin: false,
      isAccountSuspended: false,
    };
  }

  if (!session?.user?.id) {
    return {
      accountStatus: 'sesion_ausente',
      userRole: 'USUARIO',
      isAdmin: false,
      isAccountSuspended: false,
    };
  }

  if (isNetworkError) {
    return {
      accountStatus: 'error_red',
      userRole: profile?.rol ?? 'USUARIO',
      isAdmin: profile?.rol === 'ADMIN',
      isAccountSuspended: false, // ¡Nunca marcar suspendido por error de red!
    };
  }

  if (profile) {
    const isAdmin = profile.rol === 'ADMIN';
    const isSuspended = profile.estado === false;
    return {
      accountStatus: isSuspended ? 'suspendido' : 'activo',
      userRole: profile.rol,
      isAdmin,
      isAccountSuspended: isSuspended,
    };
  }

  // Si no hay fila en public.usuarios todavía (bootstrap o migración pendiente)
  return {
    accountStatus: 'activo',
    userRole: 'USUARIO',
    isAdmin: false,
    isAccountSuspended: false,
  };
}

describe('AuthContext - Integración de Roles y Estado de Cuenta (Serie AX)', () => {
  const dummySession = {
    user: {
      id: 'usr-123',
      email: 'explorador@chaski.pe',
      user_metadata: { nombre: 'Chaski Explorador' },
    },
  };

  describe('Diferenciación estricta de estados de cuenta', () => {
    it('determina estado cargando durante la inicialización de la sesión', () => {
      const res = resolveAuthStatus({
        session: null,
        loading: true,
        profile: null,
      });

      expect(res.accountStatus).toBe('cargando');
      expect(res.isAdmin).toBe(false);
      expect(res.isAccountSuspended).toBe(false);
    });

    it('determina sesion_ausente cuando no hay usuario autenticado', () => {
      const res = resolveAuthStatus({
        session: null,
        loading: false,
        profile: null,
      });

      expect(res.accountStatus).toBe('sesion_ausente');
      expect(res.isAdmin).toBe(false);
      expect(res.isAccountSuspended).toBe(false);
    });

    it('determina activo cuando el perfil tiene estado true', () => {
      const profile: UserProfileRecord = {
        id: 'usr-123',
        nombre: 'Chaski Explorador',
        rol: 'USUARIO',
        estado: true,
        fecha_registro: '2026-03-01T00:00:00Z',
      };

      const res = resolveAuthStatus({
        session: dummySession,
        loading: false,
        profile,
      });

      expect(res.accountStatus).toBe('activo');
      expect(res.isAccountSuspended).toBe(false);
      expect(res.isAdmin).toBe(false);
    });

    it('determina suspendido cuando el perfil tiene estado false', () => {
      const profile: UserProfileRecord = {
        id: 'usr-123',
        nombre: 'Usuario Sancionado',
        rol: 'USUARIO',
        estado: false,
        fecha_registro: '2026-03-01T00:00:00Z',
      };

      const res = resolveAuthStatus({
        session: dummySession,
        loading: false,
        profile,
      });

      expect(res.accountStatus).toBe('suspendido');
      expect(res.isAccountSuspended).toBe(true);
      expect(res.isAdmin).toBe(false);
    });

    it('CRÍTICO: no interpreta errores de red como suspensión de cuenta', () => {
      const res = resolveAuthStatus({
        session: dummySession,
        loading: false,
        profile: null,
        isNetworkError: true,
      });

      expect(res.accountStatus).toBe('error_red');
      expect(res.isAccountSuspended).toBe(false); // No bloquea la cuenta falsamente
      expect(res.isAdmin).toBe(false);
    });

    it('mantiene la cuenta activa si el usuario aún no tiene fila en public.usuarios (resiliencia)', () => {
      const res = resolveAuthStatus({
        session: dummySession,
        loading: false,
        profile: null,
        isNetworkError: false,
      });

      expect(res.accountStatus).toBe('activo');
      expect(res.isAccountSuspended).toBe(false);
      expect(res.userRole).toBe('USUARIO');
      expect(res.isAdmin).toBe(false);
    });
  });

  describe('Evaluación de roles y privilegios de administración', () => {
    it('otorga privilegios de administración a usuarios con rol ADMIN activo', () => {
      const profile: UserProfileRecord = {
        id: 'usr-admin',
        nombre: 'Superintendente Chaski',
        rol: 'ADMIN',
        estado: true,
        fecha_registro: '2026-01-01T00:00:00Z',
      };

      const res = resolveAuthStatus({
        session: { user: { id: 'usr-admin' } },
        loading: false,
        profile,
      });

      expect(res.accountStatus).toBe('activo');
      expect(res.userRole).toBe('ADMIN');
      expect(res.isAdmin).toBe(true);
      expect(res.isAccountSuspended).toBe(false);
    });

    it('un administrador suspendido conserva rol ADMIN pero queda marcado como suspendido', () => {
      const profile: UserProfileRecord = {
        id: 'usr-admin-suspendido',
        nombre: 'Admin Inactivo',
        rol: 'ADMIN',
        estado: false,
        fecha_registro: '2026-01-01T00:00:00Z',
      };

      const res = resolveAuthStatus({
        session: { user: { id: 'usr-admin-suspendido' } },
        loading: false,
        profile,
      });

      expect(res.accountStatus).toBe('suspendido');
      expect(res.userRole).toBe('ADMIN');
      expect(res.isAdmin).toBe(true);
      expect(res.isAccountSuspended).toBe(true);
    });

    it('deniega privilegios de administración a usuarios con rol USUARIO', () => {
      const profile: UserProfileRecord = {
        id: 'usr-estudiante',
        nombre: 'Estudiante',
        rol: 'USUARIO',
        estado: true,
        fecha_registro: '2026-02-01T00:00:00Z',
      };

      const res = resolveAuthStatus({
        session: { user: { id: 'usr-estudiante' } },
        loading: false,
        profile,
      });

      expect(res.userRole).toBe('USUARIO');
      expect(res.isAdmin).toBe(false);
    });
  });
});
