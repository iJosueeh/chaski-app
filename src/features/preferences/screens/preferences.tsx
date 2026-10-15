import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/context/auth-context';
import { usePreferences } from '@/features/preferences/context/preferences-context';
import { signOut } from '@/features/auth/services/auth.service';
import { CategoryChip } from '../components/category-chip';
import { BudgetSelector } from '../components/budget-selector';
import { ProfileIdentityCard } from '../components/profile-identity-card';
import {
  parseBudgetValue,
  validatePreferencesForm,
} from '../utils/preference-validation';

/**
 * Pantalla de visualización y edición de preferencias desde Perfil (Serie AX).
 *
 * Características:
 * - Precarga las categorías y presupuesto persistidos del usuario.
 * - Reutiliza CategoryChip, BudgetSelector y validatePreferencesForm.
 * - Detecta cambios frente a los valores iniciales para habilitar el guardado solo si hubo modificaciones.
 * - Al guardar con éxito permanece en la pantalla actual, actualiza el estado inicial y muestra confirmación.
 * - Muestra errores recuperables preservando las selecciones del usuario.
 * - Preserva movilidad_preferida y acciones de seguridad (Cambiar contraseña, Cerrar sesión).
 */
export function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAdmin, updateProfileName, updateProfileAvatar, removeProfileAvatar } = useAuth();
  const {
    categories,
    userPreferences,
    loading: contextLoading,
    loadCategories,
    checkPreferences,
    savePreferences,
  } = usePreferences();

  // Estados locales editables
  const [localCategoryIds, setLocalCategoryIds] = useState<string[]>([]);
  const [localGastoMin, setLocalGastoMin] = useState<string>('');
  const [localGastoMax, setLocalGastoMax] = useState<string>('');
  // Línea base guardada para comparar cambios frente al estado persistido (H-03)
  const [baseline, setBaseline] = useState<{
    categoryIds: string[];
    gastoMin: string;
    gastoMax: string;
  } | null>(null);

  const [initialLoaded, setInitialLoaded] = useState(false);

  // Estados de interfaz
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Carga inicial de catálogo y preferencias del usuario
  useEffect(() => {
    loadCategories();
    checkPreferences({ isBackground: true });
  }, [loadCategories, checkPreferences]);

  // Precargar valores del perfil cuando userPreferences esté disponible
  useEffect(() => {
    if (userPreferences && !initialLoaded) {
      const persistedIds = userPreferences.categorias.map((c) => c.id);
      const persistedMin = userPreferences.gasto_min != null ? String(userPreferences.gasto_min) : '';
      const persistedMax = userPreferences.gasto_max != null ? String(userPreferences.gasto_max) : '';

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalCategoryIds(persistedIds);
      setLocalGastoMin(persistedMin);
      setLocalGastoMax(persistedMax);
      setBaseline({
        categoryIds: persistedIds,
        gastoMin: persistedMin,
        gastoMax: persistedMax,
      });
      setInitialLoaded(true);
    }
  }, [userPreferences, initialLoaded]);

  // Alternar selección de categoría local
  const handleToggleCategory = useCallback((id: string) => {
    setLocalCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
    setSuccessMessage(null);
    setErrorMessage(null);
  }, []);

  // Handlers para presupuesto
  const handleGastoMinChange = useCallback((text: string) => {
    setLocalGastoMin(text);
    setSuccessMessage(null);
    setErrorMessage(null);
  }, []);

  const handleGastoMaxChange = useCallback((text: string) => {
    setLocalGastoMax(text);
    setSuccessMessage(null);
    setErrorMessage(null);
  }, []);

  // IDs de categorías válidas y activas
  const activeCategoryIds = useMemo(
    () => categories.filter((c) => c.estado).map((c) => c.id),
    [categories],
  );

  // Validación de formulario
  const validation = useMemo(() => {
    return validatePreferencesForm({
      categoryIds: localCategoryIds,
      gastoMin: parseBudgetValue(localGastoMin),
      gastoMax: parseBudgetValue(localGastoMax),
      availableActiveCategoryIds: activeCategoryIds,
    });
  }, [localCategoryIds, localGastoMin, localGastoMax, activeCategoryIds]);

  // Detección de cambios frente a la línea base confirmada (H-03)
  const hasChanges = useMemo(() => {
    if (!baseline) return true;

    const baseIds = new Set(baseline.categoryIds);
    const currentIds = new Set(localCategoryIds);

    const categoriesChanged =
      baseIds.size !== currentIds.size ||
      [...currentIds].some((id) => !baseIds.has(id));

    const minChanged = localGastoMin.trim() !== baseline.gastoMin.trim();
    const maxChanged = localGastoMax.trim() !== baseline.gastoMax.trim();

    return categoriesChanged || minChanged || maxChanged;
  }, [baseline, localCategoryIds, localGastoMin, localGastoMax]);

  const canSave = validation.isValid && hasChanges && !saving && !contextLoading;

  // Guardar cambios utilizando savePreferences del contexto
  const handleSaveChanges = async () => {
    if (!validation.isValid) {
      if (validation.errors.categories) {
        setErrorMessage(validation.errors.categories);
      } else if (validation.errors.budgetRange) {
        setErrorMessage(validation.errors.budgetRange);
      }
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      const success = await savePreferences({
        categoryIds: localCategoryIds,
        gastoMin: localGastoMin,
        gastoMax: localGastoMax,
      });

      if (success) {
        // Actualizar la línea base confirmada para que hasChanges vuelva a false de inmediato (H-03)
        setBaseline({
          categoryIds: [...localCategoryIds],
          gastoMin: localGastoMin,
          gastoMax: localGastoMax,
        });
        setSuccessMessage('Tus preferencias han sido actualizadas exitosamente.');
      } else {
        setErrorMessage(
          'No se pudieron actualizar tus preferencias. Por favor, intenta de nuevo.',
        );
      }
    } catch {
      setErrorMessage('Ocurrió un error inesperado al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.canvas}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {/* 1. SECCIÓN: IDENTIDAD DEL EXPLORADOR (SERIE AX) */}
      <ProfileIdentityCard
        user={user}
        onUpdateName={updateProfileName}
        onUpdateAvatar={updateProfileAvatar}
        onRemoveAvatar={removeProfileAvatar}
      />

      {/* 2. SECCIÓN: PREFERENCIAS DE RUTA (SERIE AX) */}
      <View style={styles.cardContainer}>
        {/* Cabecera */}
        <View style={styles.cardHeader}>
          <Text style={styles.headerSerie}>SERIE AX · EXPEDICIÓN DE VIAJERO</Text>
          <Text style={styles.headerTitle}>Preferencias de Ruta</Text>
          <Text style={styles.headerSubtitle}>
            Ajusta tus afinidades culturales y presupuesto habitual
          </Text>
        </View>

        <View style={styles.goldDivider} />

        {/* SECCIÓN 1: CATEGORÍAS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>INTERESES CULTURALES</Text>
          <Text style={styles.sectionHint}>
            {localCategoryIds.length} seleccionada{localCategoryIds.length === 1 ? '' : 's'}
          </Text>
        </View>

        {contextLoading && categories.length === 0 ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="small" color={Colors.light.primary} />
            <Text style={styles.loadingText}>Cargando categorías...</Text>
          </View>
        ) : (
          <View style={styles.chipsContainer}>
            {categories.map((category) => (
              <CategoryChip
                key={category.id}
                category={category}
                selected={localCategoryIds.includes(category.id)}
                onToggle={handleToggleCategory}
                disabled={saving}
              />
            ))}
          </View>
        )}

        {/* LÍNEA DE PERFORACIÓN SERIE AX */}
        <View style={styles.perforationWrapper}>
          <View style={styles.notchLeft} />
          <View style={styles.perforationLine} />
          <View style={styles.notchRight} />
        </View>

        {/* SECCIÓN 2: PRESUPUESTO HABITUAL */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>PRESUPUESTO POR SALIDA (OPCIONAL)</Text>
        </View>

        <BudgetSelector
          gastoMinText={localGastoMin}
          gastoMaxText={localGastoMax}
          onChangeGastoMinText={handleGastoMinChange}
          onChangeGastoMaxText={handleGastoMaxChange}
          error={validation.errors.budgetRange}
          disabled={saving}
        />

        {/* MENSAJES DE ESTADO */}
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

        {/* BOTÓN PRIMARIO DE GUARDADO */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleSaveChanges}
            disabled={!canSave}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Guardar cambios de preferencias"
            accessibilityState={{ disabled: !canSave, busy: saving }}
            style={({ pressed }) => [
              styles.saveButton,
              !canSave && styles.saveButtonDisabled,
              pressed && canSave && styles.saveButtonPressed,
            ]}
          >
            {saving ? (
              <View style={styles.savingRow}>
                <ActivityIndicator color={Colors.light.surface} size="small" />
                <Text style={styles.saveButtonText}>GUARDANDO...</Text>
              </View>
            ) : (
              <Text style={styles.saveButtonText}>
                {hasChanges ? 'ACTUALIZAR PREFERENCIAS' : 'SIN CAMBIOS'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* ACCIONES DE CUENTA Y NAVEGACIÓN */}
      <View style={styles.accountActionsContainer}>
        {isAdmin && (
          <Pressable
            style={styles.adminButton}
            onPress={() => router.push('/admin')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Acceder al panel de Intendencia"
            testID="admin-intendencia-button"
          >
            <Text style={styles.adminButtonText}>🛡️ PANEL DE INTENDENCIA</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.outlineButton}
          onPress={() => router.push('/change-password')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Cambiar contraseña de acceso"
        >
          <Text style={styles.outlineButtonText}>CAMBIAR CONTRASEÑA</Text>
        </Pressable>

        <Pressable
          style={styles.ghostButton}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Volver a la pantalla anterior"
        >
          <Text style={styles.ghostButtonText}>VOLVER</Text>
        </Pressable>

        <Pressable
          style={styles.logoutButton}
          onPress={async () => {
            await signOut();
            router.replace('/login');
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión de Chaski"
        >
          <Text style={styles.logoutButtonText}>CERRAR SESIÓN</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 20,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.brand,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    gap: 4,
  },
  headerSerie: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.accent,
    letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.brand,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  goldDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.brand,
    letterSpacing: 0.8,
  },
  sectionHint: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  loadingWrapper: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  perforationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    marginHorizontal: -20,
    position: 'relative',
  },
  notchLeft: {
    width: 12,
    height: 20,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: Colors.light.background,
  },
  notchRight: {
    width: 12,
    height: 20,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    backgroundColor: Colors.light.background,
  },
  perforationLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
  },
  errorBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FDECEA',
    borderWidth: 1,
    borderColor: Colors.light.carmine,
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
    borderColor: Colors.light.success,
  },
  successText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#3B682D',
    fontWeight: '600',
  },
  actionRow: {
    marginTop: 8,
  },
  saveButton: {
    height: 48,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  saveButtonDisabled: {
    opacity: 0.45,
    backgroundColor: Colors.light.textSecondary,
  },
  saveButtonPressed: {
    backgroundColor: Colors.light.primaryDark,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.light.surface,
  },
  accountActionsContainer: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  adminButton: {
    width: '100%',
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.accent,
    backgroundColor: '#FAF5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  adminButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#8C651E',
  },
  outlineButton: {
    width: '100%',
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  outlineButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.light.primary,
  },
  ghostButton: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ghostButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
  },
  logoutButton: {
    width: '100%',
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.light.carmine,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  logoutButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.light.surface,
  },
});
