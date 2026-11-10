import { describe, expect, it } from 'vitest';

import {
  formatAuditActionLabel,
  isDestructiveAuditAction,
  summarizeAuditDetail,
} from '../utils/admin-audit-formatters';

describe('formateadores de auditoría', () => {
  describe('formatAuditActionLabel', () => {
    it('traduce los códigos conocidos a frases legibles', () => {
      expect(formatAuditActionLabel('EDITAR_USUARIO')).toBe('Editó un usuario');
      expect(formatAuditActionLabel('ANONIMIZAR_USUARIO')).toBe('Dio de baja una cuenta');
      expect(formatAuditActionLabel('ELIMINAR_SOLICITUD')).toBe('Eliminó una solicitud');
    });

    it('muestra el código crudo cuando la acción es nueva', () => {
      expect(formatAuditActionLabel('ACCION_DEL_FUTURO')).toBe('ACCION_DEL_FUTURO');
    });

    it('no revienta con valores vacíos', () => {
      expect(formatAuditActionLabel(null)).toBe('Acción desconocida');
      expect(formatAuditActionLabel('')).toBe('Acción desconocida');
    });
  });

  describe('isDestructiveAuditAction', () => {
    it('marca como destructivas las acciones que quitan acceso o borran', () => {
      expect(isDestructiveAuditAction('SUSPENDER_USUARIO')).toBe(true);
      expect(isDestructiveAuditAction('ANONIMIZAR_USUARIO')).toBe(true);
      expect(isDestructiveAuditAction('ELIMINAR_EXPEDICION')).toBe(true);
    });

    it('no marca las acciones que solo editan o reactivan', () => {
      expect(isDestructiveAuditAction('EDITAR_USUARIO')).toBe(false);
      expect(isDestructiveAuditAction('REACTIVAR_USUARIO')).toBe(false);
      expect(isDestructiveAuditAction(null)).toBe(false);
    });
  });

  describe('summarizeAuditDetail', () => {
    it('describe un cambio de nombre y de rol', () => {
      const detalle = {
        antes: { nombre: 'Keny', rol: 'USUARIO', estado: true },
        despues: { nombre: 'Keny A.', rol: 'ADMIN', estado: true },
      };

      expect(summarizeAuditDetail('EDITAR_USUARIO', detalle)).toBe(
        'Nombre: Keny → Keny A. · Rol: USUARIO → ADMIN',
      );
    });

    it('describe una suspensión a partir del cambio de estado', () => {
      const detalle = {
        antes: { nombre: 'Jose', rol: 'USUARIO', estado: true },
        despues: { nombre: 'Jose', rol: 'USUARIO', estado: false },
      };

      expect(summarizeAuditDetail('SUSPENDER_USUARIO', detalle)).toBe(
        'Acceso suspendido',
      );
    });

    it('avisa cuando no hay diferencia visible', () => {
      const detalle = {
        antes: { nombre: 'Jose', rol: 'USUARIO', estado: true },
        despues: { nombre: 'Jose', rol: 'USUARIO', estado: true },
      };

      expect(summarizeAuditDetail('EDITAR_USUARIO', detalle)).toBe(
        'Sin detalle adicional',
      );
    });

    it('resume una solicitud eliminada con su movilidad y su gasto', () => {
      const detalle = { movilidad: 'TRANSPORTE_PUBLICO', gasto_max: 60 };

      expect(summarizeAuditDetail('ELIMINAR_SOLICITUD', detalle)).toBe(
        'Movilidad: Transporte público · Gasto máximo: S/ 60',
      );
    });

    it('resume una expedición eliminada con su estado y sus paradas', () => {
      const detalle = { estado_expedicion: 'COMPLETADA', paradas_visitadas: 4 };

      expect(summarizeAuditDetail('ELIMINAR_EXPEDICION', detalle)).toBe(
        'Estado: COMPLETADA · Paradas visitadas: 4',
      );
    });

    it('devuelve el texto de respaldo cuando el detalle viene vacío', () => {
      expect(summarizeAuditDetail('ELIMINAR_SOLICITUD', null)).toBe(
        'Sin detalle adicional',
      );
      expect(summarizeAuditDetail('ACCION_RARA', { dato: 1 })).toBe(
        'Sin detalle adicional',
      );
    });
  });
});
