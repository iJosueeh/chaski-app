import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { AndeanTocapuDivider } from '@/components/andean-tocapu-divider';

export interface AdminHeaderProps {
  onBack: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function AdminHeader({ onBack, onRefresh, refreshing }: AdminHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable
          style={styles.backButton}
          onPress={onBack}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Volver al Perfil"
          testID="admin-back-button"
        >
          <Text style={styles.backButtonText}>← VOLVER</Text>
        </Pressable>

        {onRefresh && (
          <Pressable
            style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
            onPress={onRefresh}
            disabled={refreshing}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Actualizar padrón de intendencia"
            testID="admin-refresh-button"
          >
            <Text style={styles.refreshButtonText}>
              {refreshing ? 'ACTUALIZANDO...' : '↻ ACTUALIZAR'}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.titleWrapper}>
        <Text style={styles.serieLabel}>SERIE AX · GESTIÓN INSTITUCIONAL</Text>
        <Text style={styles.title}>PANEL DE INTENDENCIA</Text>
        <Text style={styles.subtitle}>
          Supervisión de exploradores, roles de acceso y estado de cuentas
        </Text>
      </View>

      <AndeanTocapuDivider style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  backButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.brand,
    letterSpacing: 0.5,
  },
  refreshButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.accent,
    backgroundColor: '#FBF8F1',
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  refreshButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.accent,
    letterSpacing: 0.5,
  },
  titleWrapper: {
    gap: 3,
  },
  serieLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.accent,
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.brand,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  divider: {
    marginVertical: 12,
  },
});
