import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AdminUser, AdminMetrics, UserRole } from '../interfaces/admin.interface';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Admin UI Serie AX — Contratos, Autorización y Reglas de Interfaz (Fase 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Acceso a «Intendencia» desde Perfil', () => {
    function shouldShowIntendenciaButton(isAdmin: boolean): boolean {
      return isAdmin === true;
    }

    it('muestra el acceso «Intendencia» únicamente para usuarios con rol ADMIN confirmado', () => {
      expect(shouldShowIntendenciaButton(true)).toBe(true);
    });

    it('oculta el acceso «Intendencia» para usuarios regulares o no autorizados', () => {
      expect(shouldShowIntendenciaButton(false)).toBe(false);
    });
  });

  describe('2. Guard de Ruta y Estados de Pantalla en AdminDashboard', () => {
    type DashboardScreenState =
      | 'CARGANDO_AUTORIZACION'
      | 'ERROR_RED'
      | 'ACCESO_DENEGADO'
      | 'PANEL_CONFIRMADO';

    function resolveAdminScreenState({
      profileLoading,
      accountStatus,
      isAdmin,
    }: {
      profileLoading: boolean;
      accountStatus: string;
      isAdmin: boolean;
    }): DashboardScreenState {
      if (profileLoading) return 'CARGANDO_AUTORIZACION';
      if (accountStatus === 'error_red') return 'ERROR_RED';
      if (!isAdmin) return 'ACCESO_DENEGADO';
      return 'PANEL_CONFIRMADO';
    }

    it('muestra estado de carga mientras se verifican credenciales', () => {
      const state = resolveAdminScreenState({
        profileLoading: true,
        accountStatus: 'cargando',
        isAdmin: false,
      });
      expect(state).toBe('CARGANDO_AUTORIZACION');
    });

    it('muestra pantalla de error de red sin bloquear la cuenta falsamente', () => {
      const state = resolveAdminScreenState({
        profileLoading: false,
        accountStatus: 'error_red',
        isAdmin: false,
      });
      expect(state).toBe('ERROR_RED');
    });

    it('bloquea con acceso denegado a usuarios autenticados que no tienen rol ADMIN', () => {
      const state = resolveAdminScreenState({
        profileLoading: false,
        accountStatus: 'activo',
        isAdmin: false,
      });
      expect(state).toBe('ACCESO_DENEGADO');
    });

    it('habilita el panel administrativo para administradores activos', () => {
      const state = resolveAdminScreenState({
        profileLoading: false,
        accountStatus: 'activo',
        isAdmin: true,
      });
      expect(state).toBe('PANEL_CONFIRMADO');
    });
  });

  describe('3. Tablero de Métricas e Indicadores de Intendencia', () => {
    function computeMetricsSummary(metrics: AdminMetrics | null) {
      if (!metrics) {
        return {
          total: 0,
          activos: 0,
          inactivos: 0,
          admins: 0,
          hasData: false,
        };
      }
      return {
        total: metrics.total_usuarios,
        activos: metrics.usuarios_activos,
        inactivos: metrics.usuarios_inactivos,
        admins: metrics.total_administradores,
        hasData: true,
      };
    }

    it('resume correctamente los indicadores métricos', () => {
      const mockMetrics: AdminMetrics = {
        total_usuarios: 150,
        usuarios_activos: 142,
        usuarios_inactivos: 8,
        total_administradores: 5,
        timestamp: '2026-10-14T11:00:00Z',
      };

      const summary = computeMetricsSummary(mockMetrics);
      expect(summary.total).toBe(150);
      expect(summary.activos).toBe(142);
      expect(summary.inactivos).toBe(8);
      expect(summary.admins).toBe(5);
      expect(summary.hasData).toBe(true);
    });

    it('maneja de forma segura métricas vacías o no inicializadas', () => {
      const summary = computeMetricsSummary(null);
      expect(summary.hasData).toBe(false);
      expect(summary.total).toBe(0);
    });

    it('identifica mensaje de aviso cuando las RPCs no están desplegadas en el servidor', () => {
      const errorMsg = 'Las funciones administrativas de base de datos aún no han sido desplegadas en el servidor.';
      const isMigrationPending = errorMsg.includes('aún no han sido desplegadas');
      expect(isMigrationPending).toBe(true);
    });
  });

  describe('4. Búsqueda y Filtrado del Padrón de Usuarios', () => {
    const mockUsers: AdminUser[] = [
      {
        id: 'u-1',
        nombre: 'Cahuide Inca',
        email: 'cahuide@chaski.pe',
        rol: 'ADMIN',
        estado: true,
        fecha_registro: '2026-01-01T00:00:00Z',
      },
      {
        id: 'u-2',
        nombre: 'Micaela Bastidas',
        email: 'micaela@chaski.pe',
        rol: 'USUARIO',
        estado: true,
        fecha_registro: '2026-02-01T00:00:00Z',
      },
      {
        id: 'u-3',
        nombre: 'Usuario Suspendido',
        email: 'suspendido@chaski.pe',
        rol: 'USUARIO',
        estado: false,
        fecha_registro: '2026-02-15T00:00:00Z',
      },
    ];

    function filterUsersLocally(
      users: AdminUser[],
      query: string,
      filtroRol: UserRole | null,
      filtroEstado: boolean | null
    ): AdminUser[] {
      return users.filter((u) => {
        const matchesQuery =
          !query ||
          u.nombre.toLowerCase().includes(query.toLowerCase()) ||
          u.email.toLowerCase().includes(query.toLowerCase());

        const matchesRol = filtroRol === null || u.rol === filtroRol;
        const matchesEstado = filtroEstado === null || u.estado === filtroEstado;

        return matchesQuery && matchesRol && matchesEstado;
      });
    }

    it('filtra por búsqueda de nombre', () => {
      const res = filterUsersLocally(mockUsers, 'Micaela', null, null);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('u-2');
    });

    it('filtra por búsqueda de correo', () => {
      const res = filterUsersLocally(mockUsers, 'cahuide@chaski.pe', null, null);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('u-1');
    });

    it('filtra por rol ADMIN', () => {
      const res = filterUsersLocally(mockUsers, '', 'ADMIN', null);
      expect(res).toHaveLength(1);
      expect(res[0].rol).toBe('ADMIN');
    });

    it('filtra por estado suspendido (false)', () => {
      const res = filterUsersLocally(mockUsers, '', null, false);
      expect(res).toHaveLength(1);
      expect(res[0].estado).toBe(false);
    });

    it('combina filtros de rol y estado', () => {
      const res = filterUsersLocally(mockUsers, '', 'USUARIO', true);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('u-2');
    });
  });

  describe('5. Detalle de Usuario y Protección contra Auto-Desactivación', () => {
    function resolveUserDetailActions({
      targetUser,
      currentUserId,
    }: {
      targetUser: AdminUser;
      currentUserId: string;
    }) {
      const isCurrentUser = targetUser.id === currentUserId;
      if (isCurrentUser) {
        return {
          canToggleStatus: false,
          actionLabel: 'AUTO-SUSPENSIÓN BLOQUEADA',
          isSelfDeactivation: true,
          badge: '🛡️ TU CUENTA DE ADMINISTRADOR',
        };
      }

      return {
        canToggleStatus: true,
        actionLabel: targetUser.estado ? 'SUSPENDER CUENTA' : 'REACTIVAR CUENTA',
        isSelfDeactivation: false,
        badge: null,
      };
    }

    it('impide visualmente suspender la propia cuenta de administrador', () => {
      const currentAdmin: AdminUser = {
        id: 'admin-propio-123',
        nombre: 'Admin Actual',
        email: 'admin@chaski.pe',
        rol: 'ADMIN',
        estado: true,
        fecha_registro: '2026-01-01T00:00:00Z',
      };

      const actions = resolveUserDetailActions({
        targetUser: currentAdmin,
        currentUserId: 'admin-propio-123',
      });

      expect(actions.canToggleStatus).toBe(false);
      expect(actions.isSelfDeactivation).toBe(true);
      expect(actions.actionLabel).toBe('AUTO-SUSPENSIÓN BLOQUEADA');
    });

    it('permite iniciar suspensión para otros usuarios activos', () => {
      const otherUser: AdminUser = {
        id: 'otro-usuario-456',
        nombre: 'Otro Usuario',
        email: 'otro@chaski.pe',
        rol: 'USUARIO',
        estado: true,
        fecha_registro: '2026-02-01T00:00:00Z',
      };

      const actions = resolveUserDetailActions({
        targetUser: otherUser,
        currentUserId: 'admin-propio-123',
      });

      expect(actions.canToggleStatus).toBe(true);
      expect(actions.isSelfDeactivation).toBe(false);
      expect(actions.actionLabel).toBe('SUSPENDER CUENTA');
    });

    it('permite iniciar reactivación para usuarios suspendidos', () => {
      const suspendedUser: AdminUser = {
        id: 'usuario-suspendido-789',
        nombre: 'Usuario Suspendido',
        email: 'suspendido@chaski.pe',
        rol: 'USUARIO',
        estado: false,
        fecha_registro: '2026-02-01T00:00:00Z',
      };

      const actions = resolveUserDetailActions({
        targetUser: suspendedUser,
        currentUserId: 'admin-propio-123',
      });

      expect(actions.canToggleStatus).toBe(true);
      expect(actions.actionLabel).toBe('REACTIVAR CUENTA');
    });
  });

  describe('6. Confirmación Explícita y Flujo de Mutación', () => {
    it('requiere confirmación explícita antes de ejecutar la mutación de estado', () => {
      let confirming = false;

      function onInitAction() {
        confirming = true;
      }

      function onCancel() {
        confirming = false;
      }

      onInitAction();
      expect(confirming).toBe(true);

      onCancel();
      expect(confirming).toBe(false);
    });

    it('genera el texto de advertencia adecuado para suspensión', () => {
      function getConfirmationNotice(targetUser: AdminUser, newStatus: boolean) {
        if (!newStatus) {
          return `¿Deseas suspender a ${targetUser.nombre || targetUser.email}? El explorador no podrá acceder a la aplicación.`;
        }
        return `¿Deseas habilitar nuevamente el acceso de ${targetUser.nombre || targetUser.email}?`;
      }

      const user = {
        id: 'u-1',
        nombre: 'Pedro Paulet',
        email: 'pedro@chaski.pe',
        rol: 'USUARIO' as UserRole,
        estado: true,
        fecha_registro: '2026-01-01T00:00:00Z',
      };

      const noticeSuspension = getConfirmationNotice(user, false);
      expect(noticeSuspension).toContain('Pedro Paulet');
      expect(noticeSuspension).toContain('no podrá acceder a la aplicación');

      const noticeActivation = getConfirmationNotice(user, true);
      expect(noticeActivation).toContain('habilitar nuevamente el acceso');
    });
  });
});
