/**
 * Modal de edición de usuario del panel de intendencia (Fase 1 · APF3).
 *
 * Permite editar nombre, rol y estado, y ejecutar la baja definitiva
 * (anonimización). Toda validación se hace antes de llamar al servicio, y la
 * base de datos vuelve a validar con las mismas reglas.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AndeanTocapuDivider } from '@/components/andean-tocapu-divider';
import { Colors, Fonts } from '@/constants/theme';

import type {
  AdminUpdateUserInput,
  AdminUser,
  UserRole,
} from '../interfaces/admin.interface';
import {
  ADMIN_NOMBRE_MAX_LENGTH,
  ADMIN_NOMBRE_MIN_LENGTH,
} from '../interfaces/admin.interface';
import {
  hasUserChanges,
  normalizeUserName,
  validateAdminUserInput,
} from '../utils/admin-validation';

export interface AdminUserEditModalProps {
  user: AdminUser | null;
  visible: boolean;
  onClose: () => void;
  currentUserId: string | null;
  onSave: (input: AdminUpdateUserInput) => Promise<{ success: boolean; error?: string }>;
  onAnonymize: (userId: string) => Promise<{ success: boolean; error?: string }>;
  isSaving: boolean;
}

/**
 * Envoltorio del modal. El formulario se remonta con `key={user.id}` para
 * arrancar con estado limpio al cambiar de usuario: así no hace falta
 * sincronizar con useEffect (evita renders en cascada).
 */
export function AdminUserEditModal(props: AdminUserEditModalProps) {
  const { user, visible, onClose } = props;

  if (!user) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <AdminUserEditForm key={user.id} {...props} user={user} />
      </View>
    </Modal>
  );
}

interface AdminUserEditFormProps
  extends Omit<AdminUserEditModalProps, 'user' | 'visible'> {
  user: AdminUser;
}

function AdminUserEditForm({
  user,
  onClose,
  currentUserId,
  onSave,
  onAnonymize,
  isSaving,
}: AdminUserEditFormProps) {
  const [nombre, setNombre] = useState<string>(user.nombre);
  const [rol, setRol] = useState<UserRole>(user.rol);
  const [estado, setEstado] = useState<boolean>(user.estado);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmingBaja, setConfirmingBaja] = useState<boolean>(false);

  const isCurrentUser = user.id === currentUserId;
  const draft = { nombre, rol, estado };
  const hayCambios = hasUserChanges(user, draft);

  const handleClose = () => {
    if (isSaving) return;
    setConfirmingBaja(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    onClose();
  };

  const handleSave = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const input: AdminUpdateUserInput = {
      id: user.id,
      nombre: normalizeUserName(nombre),
      rol,
      estado,
    };

    const validationError = validateAdminUserInput(input);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!hayCambios) {
      setErrorMessage('No hay cambios que guardar.');
      return;
    }

    const result = await onSave(input);

    if (result.success) {
      setSuccessMessage('Cambios guardados correctamente.');
    } else {
      setErrorMessage(result.error ?? 'No fue posible guardar los cambios.');
    }
  };

  const handleAnonymize = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!confirmingBaja) {
      setConfirmingBaja(true);
      return;
    }

    const result = await onAnonymize(user.id);

    if (result.success) {
      setSuccessMessage('Usuario dado de baja: datos anonimizados y acceso desactivado.');
      setConfirmingBaja(false);
    } else {
      setErrorMessage(result.error ?? 'No fue posible dar de baja al usuario.');
      setConfirmingBaja(false);
    }
  };

  const nombreInvalido =
    normalizeUserName(nombre).length < ADMIN_NOMBRE_MIN_LENGTH ||
    normalizeUserName(nombre).length > ADMIN_NOMBRE_MAX_LENGTH;

  return (
    <View style={styles.card} testID="admin-edit-modal">
      <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.headerEyebrow}>INTENDENCIA · EDICIÓN</Text>
              <Text style={styles.headerTitle}>{user.nombre || 'Usuario'}</Text>
              {!!user.email && <Text style={styles.headerEmail}>{user.email}</Text>}
            </View>

            <AndeanTocapuDivider />

            {/* Nombre */}
            <Text style={styles.fieldLabel}>NOMBRE VISIBLE</Text>
            <TextInput
              testID="admin-edit-nombre"
              style={[styles.input, nombreInvalido && styles.inputError]}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Nombre del explorador"
              placeholderTextColor={Colors.light.textSecondary}
              editable={!isSaving}
              maxLength={ADMIN_NOMBRE_MAX_LENGTH + 10}
              accessibilityLabel="Nombre visible del usuario"
            />
            <Text style={styles.fieldHint}>
              Entre {ADMIN_NOMBRE_MIN_LENGTH} y {ADMIN_NOMBRE_MAX_LENGTH} caracteres
              ({normalizeUserName(nombre).length} actuales)
            </Text>

            {/* Rol */}
            <Text style={styles.fieldLabel}>ROL</Text>
            <View style={styles.segmentRow}>
              <Pressable
                testID="admin-edit-rol-usuario"
                style={[
                  styles.segment,
                  rol === 'USUARIO' && styles.segmentActive,
                  isCurrentUser && styles.segmentDisabled,
                ]}
                onPress={() => setRol('USUARIO')}
                disabled={isSaving || isCurrentUser}
                accessibilityRole="button"
                accessibilityLabel="Asignar rol USUARIO"
              >
                <Text style={[styles.segmentText, rol === 'USUARIO' && styles.segmentTextActive]}>
                  USUARIO
                </Text>
              </Pressable>
              <Pressable
                testID="admin-edit-rol-admin"
                style={[
                  styles.segment,
                  rol === 'ADMIN' && styles.segmentActive,
                  isCurrentUser && styles.segmentDisabled,
                ]}
                onPress={() => setRol('ADMIN')}
                disabled={isSaving || isCurrentUser}
                accessibilityRole="button"
                accessibilityLabel="Asignar rol ADMIN"
              >
                <Text style={[styles.segmentText, rol === 'ADMIN' && styles.segmentTextActive]}>
                  ADMIN
                </Text>
              </Pressable>
            </View>
            {isCurrentUser && (
              <Text style={styles.fieldHintWarning}>
                No puedes cambiar tu propio rol ni desactivar tu cuenta.
              </Text>
            )}

            {/* Estado */}
            <Text style={styles.fieldLabel}>ESTADO DE LA CUENTA</Text>
            <View style={styles.segmentRow}>
              <Pressable
                testID="admin-edit-estado-activo"
                style={[
                  styles.segment,
                  estado && styles.segmentActive,
                  isCurrentUser && styles.segmentDisabled,
                ]}
                onPress={() => setEstado(true)}
                disabled={isSaving || isCurrentUser}
                accessibilityRole="button"
                accessibilityLabel="Activar cuenta"
              >
                <Text style={[styles.segmentText, estado && styles.segmentTextActive]}>
                  ACTIVO
                </Text>
              </Pressable>
              <Pressable
                testID="admin-edit-estado-suspendido"
                style={[
                  styles.segment,
                  !estado && styles.segmentActive,
                  isCurrentUser && styles.segmentDisabled,
                ]}
                onPress={() => setEstado(false)}
                disabled={isSaving || isCurrentUser}
                accessibilityRole="button"
                accessibilityLabel="Suspender cuenta"
              >
                <Text style={[styles.segmentText, !estado && styles.segmentTextActive]}>
                  SUSPENDIDO
                </Text>
              </Pressable>
            </View>

            {!!errorMessage && (
              <View style={styles.messageBoxError} testID="admin-edit-error">
                <Text style={styles.messageTextError}>{errorMessage}</Text>
              </View>
            )}
            {!!successMessage && (
              <View style={styles.messageBoxOk} testID="admin-edit-success">
                <Text style={styles.messageTextOk}>{successMessage}</Text>
              </View>
            )}

            {/* Acciones */}
            <Pressable
              testID="admin-edit-save"
              style={[styles.primaryButton, (isSaving || !hayCambios) && styles.disabledButton]}
              onPress={handleSave}
              disabled={isSaving || !hayCambios}
              accessibilityRole="button"
              accessibilityLabel="Guardar cambios del usuario"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={Colors.light.surface} />
              ) : (
                <Text style={styles.primaryButtonText}>GUARDAR CAMBIOS</Text>
              )}
            </Pressable>

            <Pressable
              testID="admin-edit-anonymize"
              style={[styles.dangerButton, isSaving && styles.disabledButton]}
              onPress={handleAnonymize}
              disabled={isSaving || isCurrentUser}
              accessibilityRole="button"
              accessibilityLabel="Dar de baja definitiva al usuario"
            >
              <Text style={styles.dangerButtonText}>
                {confirmingBaja ? 'CONFIRMAR BAJA DEFINITIVA' : 'DAR DE BAJA (ANONIMIZAR)'}
              </Text>
            </Pressable>
            <Text style={styles.dangerHint}>
              La baja conserva el registro histórico pero anula el nombre y
              desactiva el acceso. El proyecto no permite borrado físico de usuarios.
            </Text>

            <Pressable
              testID="admin-edit-cancel"
              style={styles.secondaryButton}
              onPress={handleClose}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel="Cancelar edición"
            >
              <Text style={styles.secondaryButtonText}>CANCELAR</Text>
            </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.light.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 20,
    gap: 10,
  },
  header: {
    gap: 4,
  },
  headerEyebrow: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  headerTitle: {
    fontFamily: Fonts.display,
    fontSize: 20,
    color: Colors.light.text,
  },
  headerEmail: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  fieldLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginTop: 6,
  },
  fieldHint: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  fieldHintWarning: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.light.carmine,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  inputError: {
    borderColor: Colors.light.error,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  segmentActive: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  segmentDisabled: {
    opacity: 0.45,
  },
  segmentText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.light.text,
  },
  segmentTextActive: {
    color: Colors.light.surface,
  },
  messageBoxError: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 10,
    padding: 10,
  },
  messageTextError: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.error,
  },
  messageBoxOk: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 10,
    padding: 10,
  },
  messageTextOk: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.success,
  },
  primaryButton: {
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    letterSpacing: 1.2,
    color: Colors.light.surface,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: Colors.light.error,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerButtonText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.light.error,
  },
  dangerHint: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.light.textSecondary,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
