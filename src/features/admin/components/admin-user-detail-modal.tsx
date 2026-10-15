import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { AndeanTocapuDivider } from '@/components/andean-tocapu-divider';
import type { AdminUser } from '../interfaces/admin.interface';

export interface AdminUserDetailModalProps {
  user: AdminUser | null;
  visible: boolean;
  onClose: () => void;
  currentUserId: string | null;
  onStatusChange: (userId: string, newStatus: boolean) => Promise<{ success: boolean; error?: string }>;
  isUpdating: boolean;
}

export function AdminUserDetailModal({
  user,
  visible,
  onClose,
  currentUserId,
  onStatusChange,
  isUpdating,
}: AdminUserDetailModalProps) {
  const [confirmingAction, setConfirmingAction] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!user) return null;

  const isCurrentUser = user.id === currentUserId;
  const isActivo = user.estado;
  const targetNewStatus = !isActivo;

  const formattedDate = user.fecha_registro
    ? new Date(user.fecha_registro).toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'No registrada';

  const handleClose = () => {
    if (isUpdating) return;
    setConfirmingAction(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    onClose();
  };

  const handleExecuteStatusChange = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await onStatusChange(user.id, targetNewStatus);

    if (result.success) {
      setSuccessMessage(
        targetNewStatus
          ? 'Cuenta reactivada exitosamente.'
          : 'Cuenta suspendida exitosamente.'
      );
      setConfirmingAction(false);
      // Cerrar tras 800ms para mostrar confirmación
      setTimeout(() => {
        handleClose();
      }, 800);
    } else {
      setErrorMessage(result.error || 'No se pudo actualizar el estado.');
      setConfirmingAction(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard} testID="admin-user-detail-modal">
          {/* Encabezado */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.serieLabel}>EXPEDIENTE DE EXPLORADOR</Text>
              <Text style={styles.modalTitle}>Detalle de Usuario</Text>
            </View>
            <Pressable
              style={styles.closeIconButton}
              onPress={handleClose}
              disabled={isUpdating}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Cerrar modal de detalle"
            >
              <Text style={styles.closeIconText}>✕</Text>
            </Pressable>
          </View>

          <AndeanTocapuDivider style={styles.divider} />

          {/* Ficha de datos */}
          <View style={styles.dataFields}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>NOMBRE:</Text>
              <Text style={styles.fieldValue}>{user.nombre || 'Sin nombre registrado'}</Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>CORREO:</Text>
              <Text style={styles.fieldValue}>{user.email || 'Sin correo registrado'}</Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>ID USUARIO:</Text>
              <Text style={styles.fieldValueMono} numberOfLines={1} ellipsizeMode="middle">
                {user.id}
              </Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>ROL INSTITUCIONAL:</Text>
              <View style={[styles.badge, user.rol === 'ADMIN' ? styles.badgeAdmin : styles.badgeUser]}>
                <Text style={[styles.badgeText, user.rol === 'ADMIN' ? styles.badgeTextAdmin : styles.badgeTextUser]}>
                  {user.rol}
                </Text>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>ESTADO DE ACCESO:</Text>
              <View style={[styles.badge, isActivo ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.badgeText, isActivo ? styles.badgeTextActive : styles.badgeTextInactive]}>
                  {isActivo ? 'ACTIVO' : 'SUSPENDIDO'}
                </Text>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>FECHA REGISTRO:</Text>
              <Text style={styles.fieldValue}>{formattedDate}</Text>
            </View>
          </View>

          {/* Mensajes de error o éxito */}
          {errorMessage && (
            <View style={styles.errorBox} testID="admin-detail-error-box">
              <Text style={styles.errorTitle}>Error de Operación</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {successMessage && (
            <View style={styles.successBox} testID="admin-detail-success-box">
              <Text style={styles.successText}>✓ {successMessage}</Text>
            </View>
          )}

          {/* Sección de acciones de seguridad */}
          <View style={styles.actionsContainer}>
            {isCurrentUser ? (
              // Regla de seguridad: Impedir auto-desactivación
              <View style={styles.selfNoticeBox} testID="admin-self-deactivation-warning">
                <Text style={styles.selfNoticeTitle}>🛡️ TU CUENTA DE ADMINISTRADOR</Text>
                <Text style={styles.selfNoticeText}>
                  Por seguridad institucional, no puedes modificar el estado de tu propia cuenta de intendencia.
                </Text>
                <Pressable
                  style={[styles.actionButton, styles.disabledButton]}
                  disabled={true}
                  accessibilityLabel="Auto-desactivación bloqueada"
                >
                  <Text style={styles.disabledButtonText}>AUTO-SUSPENSIÓN BLOQUEADA</Text>
                </Pressable>
              </View>
            ) : confirmingAction ? (
              // Confirmación explícita requerida
              <View style={styles.confirmBox} testID="admin-confirm-action-box">
                <Text style={styles.confirmTitle}>
                  {targetNewStatus ? '¿CONFIRMAR REACTIVACIÓN?' : '¿CONFIRMAR SUSPENSIÓN?'}
                </Text>
                <Text style={styles.confirmText}>
                  {targetNewStatus
                    ? `¿Deseas habilitar nuevamente el acceso de ${user.nombre || user.email}?`
                    : `¿Deseas suspender a ${user.nombre || user.email}? El explorador no podrá acceder a la aplicación.`}
                </Text>

                <View style={styles.confirmButtonsRow}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => setConfirmingAction(false)}
                    disabled={isUpdating}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar operación"
                  >
                    <Text style={styles.cancelButtonText}>CANCELAR</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.confirmExecuteButton,
                      targetNewStatus ? styles.reactivateButton : styles.suspendButton,
                      isUpdating && styles.disabledButton,
                    ]}
                    onPress={handleExecuteStatusChange}
                    disabled={isUpdating}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={targetNewStatus ? 'Confirmar reactivación' : 'Confirmar suspensión'}
                    testID="admin-confirm-execute-button"
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmExecuteButtonText}>
                        {targetNewStatus ? 'SÍ, ACTIVAR' : 'SÍ, SUSPENDER'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              // Botón inicial para iniciar acción con confirmación
              <Pressable
                style={[
                  styles.actionButton,
                  isActivo ? styles.suspendButton : styles.reactivateButton,
                ]}
                onPress={() => setConfirmingAction(true)}
                disabled={isUpdating}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={isActivo ? 'Suspender cuenta de usuario' : 'Reactivar cuenta de usuario'}
                testID="admin-init-status-change-button"
              >
                <Text style={styles.actionButtonText}>
                  {isActivo ? 'SUSPENDER CUENTA' : 'REACTIVAR CUENTA'}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={styles.closeTextButton}
              onPress={handleClose}
              disabled={isUpdating}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Volver al padrón"
            >
              <Text style={styles.closeTextButtonText}>VOLVER AL PADRÓN</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(43, 30, 22, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 18,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  serieLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.light.accent,
    letterSpacing: 1,
  },
  modalTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.brand,
  },
  closeIconButton: {
    padding: 4,
  },
  closeIconText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    fontWeight: '700',
  },
  divider: {
    marginVertical: 4,
  },
  dataFields: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
    gap: 10,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.brand,
    fontWeight: '600',
  },
  fieldValueMono: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.light.textSecondary,
    maxWidth: '55%',
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeAdmin: {
    backgroundColor: '#FAF5E8',
    borderColor: '#EFE0B8',
  },
  badgeUser: {
    backgroundColor: '#F0EDE6',
    borderColor: Colors.light.border,
  },
  badgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeTextAdmin: {
    color: '#8C651E',
  },
  badgeTextUser: {
    color: Colors.light.textSecondary,
  },
  badgeActive: {
    backgroundColor: '#F0F7ED',
    borderColor: '#CDE5C5',
  },
  badgeInactive: {
    backgroundColor: '#FDF2F0',
    borderColor: '#F1CDCB',
  },
  badgeTextActive: {
    color: '#3B682D',
  },
  badgeTextInactive: {
    color: Colors.light.carmine,
  },
  errorBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FDECEA',
    borderWidth: 1,
    borderColor: Colors.light.carmine,
    gap: 2,
  },
  errorTitle: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.carmine,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.carmine,
    lineHeight: 16,
  },
  successBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#EBF4E8',
    borderWidth: 1,
    borderColor: '#CDE5C5',
  },
  successText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#3B682D',
  },
  actionsContainer: {
    marginTop: 4,
    gap: 10,
  },
  selfNoticeBox: {
    backgroundColor: '#FAF5E8',
    borderColor: '#EFE0B8',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  selfNoticeTitle: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.accent,
    letterSpacing: 0.5,
  },
  selfNoticeText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.light.textSecondary,
    lineHeight: 15,
  },
  actionButton: {
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  suspendButton: {
    backgroundColor: Colors.light.carmine,
  },
  reactivateButton: {
    backgroundColor: '#3B682D',
  },
  disabledButton: {
    backgroundColor: Colors.light.border,
    opacity: 0.7,
  },
  disabledButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  confirmBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.accent,
    backgroundColor: '#FAF8F3',
    gap: 8,
  },
  confirmTitle: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.brand,
    letterSpacing: 0.5,
  },
  confirmText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.brand,
    lineHeight: 16,
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    height: 38,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  confirmExecuteButton: {
    flex: 1.2,
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmExecuteButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeTextButton: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeTextButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
  },
});
