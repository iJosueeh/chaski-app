import { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { AuthTicketLayout } from '@/features/auth/components/auth-ticket-layout';
import { AndeanTransitStamp } from '@/features/auth/components/andean-transit-stamp';
import { usePreferences } from '@/features/preferences/context/preferences-context';
import { signOut } from '@/features/auth/services/auth.service';
import { CategoryChip } from '../components/category-chip';
import { BudgetSelector } from '../components/budget-selector';
import {
  parseBudgetValue,
  validatePreferencesForm,
} from '../utils/preference-validation';

/**
 * Pantalla unificada de onboarding de preferencias con identidad Serie AX.
 *
 * Características:
 * - Reemplaza los pasos fragmentados de categorías y presupuesto en un único boleto.
 * - Carga dinámicamente las categorías activas desde Supabase.
 * - Exige al menos 1 categoría activa y permite presupuesto omitido/personalizado/presets.
 * - Utiliza savePreferences del contexto (respaldado por la RPC atómica).
 * - Navegación reactiva pura: al resolverse hasPreferences=true, el RootNavigator
 *   desmonta automáticamente el OnboardingStack sin llamadas a router.replace.
 * - Permite reintentar la sincronización sin duplicar operaciones de guardado.
 * - Permite cerrar sesión discretamente para salir del onboarding en cualquier momento.
 * - Muestra errores recuperables preservando las selecciones del usuario.
 */
export function PreferencesOnboardingScreen() {
  const {
    categories,
    selectedIds,
    gastoMin,
    gastoMax,
    loading: contextLoading,
    hasPreferences,
    toggleCategory,
    setGastoMin,
    setGastoMax,
    loadCategories,
    checkPreferences,
    savePreferences,
  } = usePreferences();

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Lista de IDs de categorías válidas y activas disponibles
  const activeCategoryIds = useMemo(
    () => categories.filter((c) => c.estado).map((c) => c.id),
    [categories],
  );

  // Validación local reactiva antes de emitir
  const validation = useMemo(() => {
    return validatePreferencesForm({
      categoryIds: selectedIds,
      gastoMin: parseBudgetValue(gastoMin),
      gastoMax: parseBudgetValue(gastoMax),
      availableActiveCategoryIds: activeCategoryIds,
    });
  }, [selectedIds, gastoMin, gastoMax, activeCategoryIds]);

  const canSubmit = validation.isValid && !saving && !contextLoading;

  const handleRetrySync = async () => {
    setErrorMessage(null);
    setSaving(true);
    try {
      await checkPreferences();
    } catch {
      setErrorMessage(
        'No se pudo sincronizar el estado de tus preferencias. Verifica tu conexión a internet.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setSaving(true);
      await signOut();
    } catch {
      setErrorMessage('No se pudo cerrar la sesión. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleEmitirBoleto = async () => {
    if (!validation.isValid) {
      if (validation.errors.categories) {
        setErrorMessage(validation.errors.categories);
      } else if (validation.errors.budgetRange) {
        setErrorMessage(validation.errors.budgetRange);
      } else if (validation.errors.gastoMin || validation.errors.gastoMax) {
        setErrorMessage('Revisa los importes de presupuesto ingresados.');
      }
      return;
    }

    setErrorMessage(null);
    setSaving(true);

    try {
      // Si el usuario ya tiene preferencias registradas, sincronizamos sin duplicar la llamada RPC
      if (hasPreferences) {
        await checkPreferences();
        return;
      }

      const success = await savePreferences();
      if (!success) {
        // En caso de error de red o timeout en respuesta, comprobar si ya se persistieron
        await checkPreferences({ isBackground: true });
        if (!hasPreferences) {
          setErrorMessage(
            'No se pudieron registrar tus preferencias. Si ya fueron emitidas previamente, puedes reintentar la sincronización.',
          );
        }
      }
      // Si success === true, PreferencesContext activa hasPreferences=true
      // y RootNavigator realiza el swap automático a tabs. No usamos router.replace.
    } catch {
      try {
        await checkPreferences({ isBackground: true });
      } catch {
        // Silenciar error secundario
      }
      setErrorMessage(
        'Ocurrió un error inesperado al emitir tu boleto. Puedes reintentar la sincronización.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthTicketLayout
      serie="BOLETO DE VIAJERO · SERIE AX-01"
      title="Preferencias de Ruta"
      subtitle="Personaliza tus intereses culturales y ritmo de viaje por Lima"
      footerFolio="SERIE AX · CONTROL DE PASAJERO Y RUTAS TRADICIONALES"
      bottomDecorativeContent={
        <AndeanTransitStamp
          folio="SERIE AX-01 · EXPEDICIÓN PREFERENCIAS"
          station="ESTACIÓN CULTURAL CHASKI"
          route="CONTROL DE RUTA Y AFINIDADES"
        />
      }
    >
      {/* SECCIÓN 1: INTERESES CULTURALES */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>PASO 1</Text>
        </View>
        <Text style={styles.sectionTitle}>¿QUÉ EXPERIENCIAS BUSCAS?</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        Selecciona al menos una categoría de interés
      </Text>

      {contextLoading && categories.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color={Colors.light.primary} />
          <Text style={styles.loaderText}>Cargando catálogo cultural...</Text>
        </View>
      ) : (
        <View style={styles.chipsGrid}>
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              category={category}
              selected={selectedIds.includes(category.id)}
              onToggle={toggleCategory}
              disabled={saving}
            />
          ))}
        </View>
      )}

      {/* LÍNEA DE PERFORACIÓN DEL BOLETO */}
      <View style={styles.perforationWrapper} accessible={false}>
        <View style={styles.notchLeft} />
        <View style={styles.perforationLine} />
        <View style={styles.notchRight} />
      </View>

      {/* SECCIÓN 2: PRESUPUESTO ESTIMADO (OPCIONAL) */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>PASO 2</Text>
        </View>
        <Text style={styles.sectionTitle}>PRESUPUESTO POR SALIDA</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        Opcional — define tu rango aproximado o déjalo libre
      </Text>

      <BudgetSelector
        gastoMinText={gastoMin}
        gastoMaxText={gastoMax}
        onChangeGastoMinText={setGastoMin}
        onChangeGastoMaxText={setGastoMax}
        error={validation.errors.budgetRange}
        disabled={saving}
      />

      {/* ALERTA DE ERROR RECUPERABLE */}
      {errorMessage && (
        <View style={styles.errorBanner} accessible={true} accessibilityRole="alert">
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
          <Pressable
            onPress={handleRetrySync}
            disabled={saving}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Reintentar sincronización de preferencias"
            accessibilityHint="Comprueba si tus preferencias ya fueron guardadas en Supabase"
            style={({ pressed }) => [
              styles.retrySyncButton,
              pressed && styles.retrySyncButtonPressed,
            ]}
          >
            <Text style={styles.retrySyncButtonText}>REINTENTAR SINCRONIZACIÓN</Text>
          </Pressable>
        </View>
      )}

      {/* BOTÓN PRIMARIO DE EMISIÓN */}
      <View style={styles.actionContainer}>
        <Pressable
          onPress={handleEmitirBoleto}
          disabled={!canSubmit}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Emitir boleto y comenzar ruta"
          accessibilityHint="Guarda tus preferencias y accede a la aplicación"
          accessibilityState={{ disabled: !canSubmit, busy: saving }}
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
            pressed && canSubmit && styles.submitButtonPressed,
          ]}
        >
          {saving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator color={Colors.light.surface} size="small" />
              <Text style={styles.submitButtonText}>EMITIENDO BOLETO...</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>CONFIRMAR Y EMPEZAR RUTA</Text>
          )}
        </Pressable>

        <Text style={styles.disclaimerText}>
          Podrás modificar estas preferencias en cualquier momento desde tu perfil.
        </Text>

        {/* SALIDA DISCRETA DEL ONBOARDING */}
        <Pressable
          onPress={handleSignOut}
          disabled={saving}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          accessibilityHint="Cierra la sesión actual y regresa a la pantalla de inicio de sesión"
          style={({ pressed }) => [
            styles.signOutLink,
            pressed && styles.signOutLinkPressed,
          ]}
        >
          <Text style={styles.signOutLinkText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </AuthTicketLayout>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  sectionBadge: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sectionBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.brand,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.light.brand,
  },
  sectionSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 6,
  },
  loaderContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  perforationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    marginHorizontal: -20,
    position: 'relative',
  },
  notchLeft: {
    width: 14,
    height: 24,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: Colors.light.background,
  },
  notchRight: {
    width: 14,
    height: 24,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    backgroundColor: Colors.light.background,
  },
  perforationLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
  },
  errorBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FDECEA',
    borderWidth: 1,
    borderColor: Colors.light.carmine,
  },
  errorBannerText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.carmine,
    lineHeight: 18,
  },
  actionContainer: {
    marginTop: 16,
    gap: 10,
    alignItems: 'center',
  },
  submitButton: {
    width: '100%',
    height: 52,
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  submitButtonDisabled: {
    opacity: 0.45,
    backgroundColor: Colors.light.textSecondary,
  },
  submitButtonPressed: {
    backgroundColor: Colors.light.primaryDark,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.light.surface,
  },
  disclaimerText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  retrySyncButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.carmine,
    borderRadius: 6,
  },
  retrySyncButtonPressed: {
    opacity: 0.7,
  },
  retrySyncButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.carmine,
    letterSpacing: 0.5,
  },
  signOutLink: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutLinkPressed: {
    opacity: 0.6,
  },
  signOutLinkText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
    textDecorationLine: 'underline',
  },
});
