import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import type { User } from '@supabase/supabase-js';

import { Colors, Fonts } from '@/constants/theme';
import {
  formatMembershipDate,
  validateProfileName,
} from '@/features/auth/utils/profile-validation';

interface ProfileIdentityCardProps {
  user: User | null;
  onUpdateName: (newName: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateAvatar?: (localUri: string, base64?: string | null) => Promise<{ success: boolean; error?: string; avatarUrl?: string }>;
  onRemoveAvatar?: () => Promise<{ success: boolean; error?: string }>;
}

/**
 * Tarjeta Serie AX de «Identidad del Explorador».
 * Muestra y permite editar el nombre real del usuario, gestionar su fotografía
 * de perfil en Supabase Storage (máximo 1 avatar vigente), además de visualizar
 * su correo verificado y fecha de membresía sin alterar la sesión.
 */
export function ProfileIdentityCard({
  user,
  onUpdateName,
  onUpdateAvatar,
  onRemoveAvatar,
}: ProfileIdentityCardProps) {
  const currentName = (user?.user_metadata?.nombre as string | undefined)?.trim() ?? '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const email = user?.email ?? 'Sin correo registrado';
  const membershipDate = formatMembershipDate(user?.created_at);

  const initialLetter = (currentName ? currentName[0] : 'E').toUpperCase();

  const [prevName, setPrevName] = useState(currentName);
  const [nameInput, setNameInput] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sincronizar input local si el usuario en sesión cambia externamente
  if (prevName !== currentName) {
    setPrevName(currentName);
    setNameInput(currentName);
  }

  const hasNameChanged = useMemo(() => {
    return nameInput.trim() !== currentName;
  }, [nameInput, currentName]);

  const handleResetName = useCallback(() => {
    setNameInput(currentName);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [currentName]);

  const handlePickAvatar = async () => {
    if (!onUpdateAvatar) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      setAvatarLoading(true);
      setImageLoadError(false);
      setErrorMessage(null);
      setSuccessMessage(null);

      const asset = result.assets[0];
      const res = await onUpdateAvatar(asset.uri, asset.base64);
      if (res.success) {
        setImageLoadError(false);
        setSuccessMessage('Fotografía de perfil actualizada con éxito.');
      } else {
        setErrorMessage(res.error ?? 'No se pudo actualizar la fotografía.');
      }
    } catch {
      setErrorMessage('Ocurrió un error al seleccionar la imagen.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!onRemoveAvatar) return;

    setAvatarLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await onRemoveAvatar();
      if (res.success) {
        setImageLoadError(false);
        setSuccessMessage('Fotografía de perfil eliminada.');
      } else {
        setErrorMessage(res.error ?? 'No se pudo eliminar la fotografía.');
      }
    } catch {
      setErrorMessage('Ocurrió un error al eliminar la fotografía.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSaveName = async () => {
    const validation = validateProfileName(nameInput);
    if (!validation.isValid) {
      setErrorMessage(validation.error ?? 'Nombre no válido');
      setSuccessMessage(null);
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await onUpdateName(validation.trimmedName!);
      if (res.success) {
        setSuccessMessage('Tu nombre ha sido actualizado exitosamente.');
      } else {
        setErrorMessage(res.error ?? 'No se pudo actualizar el nombre. Intenta nuevamente.');
      }
    } catch {
      setErrorMessage('Ocurrió un error inesperado al actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.cardContainer}>
      {/* Cabecera Serie AX */}
      <View style={styles.cardHeader}>
        <Text style={styles.headerSerie}>SERIE AX · PASAPORTE CULTURAL</Text>
        <Text style={styles.headerTitle}>Identidad del Explorador</Text>
        <Text style={styles.headerSubtitle}>
          Datos personales registrados para tus boletos y rutas
        </Text>
      </View>

      <View style={styles.goldDivider} />

      {/* SECCIÓN 0: FOTOGRAFÍA DE PERFIL */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarFrame}>
          {avatarUrl && !imageLoadError ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={200}
              onError={() => setImageLoadError(true)}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initialLetter}</Text>
            </View>
          )}

          {avatarLoading && (
            <View style={styles.avatarLoadingOverlay}>
              <ActivityIndicator color={Colors.light.surface} size="small" />
            </View>
          )}
        </View>

        <View style={styles.avatarControls}>
          <Text style={styles.avatarKicker}>FOTOGRAFÍA DEL PASAPORTE</Text>
          <Text style={styles.avatarHint}>Máximo 1 imagen activa · 2 MB</Text>

          <View style={styles.avatarButtonsRow}>
            <Pressable
              onPress={handlePickAvatar}
              disabled={avatarLoading || saving}
              style={({ pressed }) => [
                styles.avatarActionButton,
                (avatarLoading || saving) && styles.saveButtonDisabled,
                pressed && styles.saveButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={avatarUrl ? 'Cambiar fotografía de perfil' : 'Añadir fotografía de perfil'}
            >
              <Text style={styles.avatarActionButtonText}>
                {avatarLoading ? 'PROCESANDO...' : avatarUrl ? 'CAMBIAR FOTO' : 'AÑADIR FOTO'}
              </Text>
            </Pressable>

            {!!avatarUrl && (
              <Pressable
                onPress={handleRemoveAvatar}
                disabled={avatarLoading || saving}
                style={({ pressed }) => [
                  styles.avatarRemoveButton,
                  (avatarLoading || saving) && styles.saveButtonDisabled,
                  pressed && styles.saveButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Eliminar fotografía de perfil"
              >
                <Text style={styles.avatarRemoveButtonText}>QUITAR</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* LÍNEA DE PERFORACIÓN SERIE AX */}
      <View style={styles.perforationWrapper}>
        <View style={styles.notchLeft} />
        <View style={styles.perforationLine} />
        <View style={styles.notchRight} />
      </View>

      {/* SECCIÓN 1: NOMBRE COMPLETO (EDITABLE) */}
      <View style={styles.fieldSection}>
        <View style={styles.labelRow}>
          <Text style={styles.fieldLabel}>NOMBRE COMPLETO</Text>
          <Text style={styles.fieldHint}>Editable</Text>
        </View>

        <TextInput
          style={[styles.textInput, !!errorMessage && styles.textInputError]}
          value={nameInput}
          onChangeText={(text) => {
            setNameInput(text);
            if (errorMessage) setErrorMessage(null);
            if (successMessage) setSuccessMessage(null);
          }}
          placeholder="Ingresa tu nombre completo"
          placeholderTextColor={Colors.light.textSecondary}
          editable={!saving}
          maxLength={60}
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel="Nombre completo del explorador"
          accessibilityHint="Modifica tu nombre visible en las expediciones"
        />

        {/* Acciones de guardado / cancelación del nombre */}
        <View style={styles.nameActionRow}>
          {hasNameChanged && (
            <Pressable
              onPress={handleResetName}
              disabled={saving}
              style={styles.cancelButton}
              accessibilityRole="button"
              accessibilityLabel="Cancelar cambios en el nombre"
            >
              <Text style={styles.cancelButtonText}>DESHACER</Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleSaveName}
            disabled={!hasNameChanged || saving}
            accessibilityRole="button"
            accessibilityLabel="Guardar nuevo nombre"
            accessibilityState={{ disabled: !hasNameChanged || saving, busy: saving }}
            style={({ pressed }) => [
              styles.saveButton,
              (!hasNameChanged || saving) && styles.saveButtonDisabled,
              pressed && hasNameChanged && !saving && styles.saveButtonPressed,
            ]}
          >
            {saving ? (
              <View style={styles.savingRow}>
                <ActivityIndicator color={Colors.light.surface} size="small" />
                <Text style={styles.saveButtonText}>GUARDANDO...</Text>
              </View>
            ) : (
              <Text style={styles.saveButtonText}>
                {hasNameChanged ? 'ACTUALIZAR NOMBRE' : 'NOMBRE AL DÍA'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* MENSAJES DE ESTADO DE IDENTIDAD */}
      {errorMessage && (
        <View style={styles.errorBox} accessible={true} accessibilityRole="alert">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View style={styles.successBox} accessible={true} accessibilityRole="alert">
          <Text style={styles.successText}>✓ {successMessage}</Text>
        </View>
      )}

      {/* LÍNEA DE PERFORACIÓN SERIE AX */}
      <View style={styles.perforationWrapper}>
        <View style={styles.notchLeft} />
        <View style={styles.perforationLine} />
        <View style={styles.notchRight} />
      </View>

      {/* SECCIÓN 2: CORREO Y MEMBRESÍA (SÓLO LECTURA) */}
      <View style={styles.infoRow}>
        <View style={styles.infoColumn}>
          <Text style={styles.infoLabel}>CORREO ELECTRÓNICO</Text>
          <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
            {email}
          </Text>
        </View>
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedBadgeText}>VERIFICADO</Text>
        </View>
      </View>

      <View style={styles.infoRowSecondary}>
        <Text style={styles.infoLabel}>MIEMBRO DESDE</Text>
        <Text style={styles.infoValueDate}>{membershipDate}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 20,
    shadowColor: Colors.light.border,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 12,
  },
  headerSerie: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.light.burgundy,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: Colors.light.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  goldDivider: {
    height: 1,
    backgroundColor: Colors.light.accent,
    opacity: 0.35,
    marginBottom: 18,
  },
  fieldSection: {
    marginBottom: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.text,
    letterSpacing: 1,
  },
  fieldHint: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.light.accent,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: Fonts.sans,
    color: Colors.light.text,
  },
  textInputError: {
    borderColor: Colors.light.burgundy,
  },
  nameActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cancelButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: Colors.light.border,
    opacity: 0.7,
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.surface,
    letterSpacing: 0.8,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorBox: {
    backgroundColor: 'rgba(125, 41, 53, 0.08)',
    borderColor: Colors.light.burgundy,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  errorText: {
    color: Colors.light.burgundy,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  successBox: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: Colors.light.accent,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  successText: {
    color: Colors.light.text,
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  perforationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    marginHorizontal: -20,
    position: 'relative',
  },
  notchLeft: {
    width: 14,
    height: 24,
    backgroundColor: Colors.light.background,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
  },
  perforationLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginHorizontal: 4,
  },
  notchRight: {
    width: 14,
    height: 24,
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoRowSecondary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoColumn: {
    flex: 1,
    marginRight: 12,
  },
  infoLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  infoValue: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '600',
  },
  infoValueDate: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: Colors.light.accent,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  verifiedBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.light.accent,
    letterSpacing: 0.5,
  },
  /* Avatar Section */
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 4,
  },
  avatarFrame: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: Colors.light.accent,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surface,
  },
  avatarInitial: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.brand,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(74, 46, 24, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarControls: {
    flex: 1,
  },
  avatarKicker: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.burgundy,
    letterSpacing: 1,
    marginBottom: 2,
  },
  avatarHint: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  avatarButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarActionButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActionButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.surface,
    letterSpacing: 0.8,
  },
  avatarRemoveButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.burgundy,
    backgroundColor: 'rgba(125, 41, 53, 0.06)',
  },
  avatarRemoveButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.burgundy,
    letterSpacing: 0.5,
  },
});
