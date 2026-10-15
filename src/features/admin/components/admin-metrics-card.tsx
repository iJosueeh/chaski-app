import { ActivityIndicator, StyleSheet, Text, View, Pressable } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import type { AdminMetrics } from '../interfaces/admin.interface';

export interface AdminMetricsCardProps {
  metrics: AdminMetrics | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export function AdminMetricsCard({ metrics, loading, error, onRetry }: AdminMetricsCardProps) {
  if (loading && !metrics) {
    return (
      <View style={styles.cardWrapper}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.light.accent} />
          <Text style={styles.loadingText}>Cargando métricas institucionales...</Text>
        </View>
      </View>
    );
  }

  if (error && !metrics) {
    return (
      <View style={[styles.cardWrapper, styles.errorCard]}>
        <Text style={styles.errorTitle}>⚠️ Indicadores no disponibles</Text>
        <Text style={styles.errorDescription}>{error}</Text>
        {onRetry && (
          <Pressable
            style={styles.retryButton}
            onPress={onRetry}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Reintentar carga de métricas"
          >
            <Text style={styles.retryButtonText}>REINTENTAR MÉTRICAS</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const total = metrics?.total_usuarios ?? 0;
  const activos = metrics?.usuarios_activos ?? 0;
  const inactivos = metrics?.usuarios_inactivos ?? 0;
  const admins = metrics?.total_administradores ?? 0;

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.gridHeader}>
        <Text style={styles.gridSectionTitle}>CENSO GENERAL DE EXPLORADORES</Text>
        {metrics?.timestamp && (
          <Text style={styles.gridTimestamp}>
            Actualizado: {new Date(metrics.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>

      <View style={styles.metricsGrid}>
        {/* Total Registrados */}
        <View style={[styles.metricBox, styles.totalBox]}>
          <Text style={styles.metricLabel}>TOTAL</Text>
          <Text style={styles.metricValue}>{total}</Text>
          <Text style={styles.metricSubtitle}>Registrados</Text>
        </View>

        {/* Activos */}
        <View style={[styles.metricBox, styles.activeBox]}>
          <Text style={[styles.metricLabel, { color: Colors.light.success }]}>ACTIVOS</Text>
          <Text style={[styles.metricValue, { color: Colors.light.success }]}>{activos}</Text>
          <Text style={styles.metricSubtitle}>Habilitados</Text>
        </View>

        {/* Inactivos */}
        <View style={[styles.metricBox, styles.inactiveBox]}>
          <Text style={[styles.metricLabel, { color: Colors.light.carmine }]}>INACTIVOS</Text>
          <Text style={[styles.metricValue, { color: Colors.light.carmine }]}>{inactivos}</Text>
          <Text style={styles.metricSubtitle}>Suspendidos</Text>
        </View>

        {/* Administradores */}
        <View style={[styles.metricBox, styles.adminBox]}>
          <Text style={[styles.metricLabel, { color: Colors.light.accent }]}>ADMINS</Text>
          <Text style={[styles.metricValue, { color: Colors.light.brand }]}>{admins}</Text>
          <Text style={styles.metricSubtitle}>Intendencia</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    width: '100%',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  errorCard: {
    backgroundColor: '#FDFBF7',
    borderColor: Colors.light.border,
    gap: 6,
  },
  errorTitle: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.carmine,
    letterSpacing: 0.5,
  },
  errorDescription: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: 'transparent',
  },
  retryButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.primary,
    letterSpacing: 0.5,
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  gridSectionTitle: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.brand,
    letterSpacing: 1,
  },
  gridTimestamp: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundElement,
    alignItems: 'center',
    gap: 2,
  },
  totalBox: {
    backgroundColor: '#F5EFE4',
  },
  activeBox: {
    backgroundColor: '#F0F7ED',
    borderColor: '#CDE5C5',
  },
  inactiveBox: {
    backgroundColor: '#FDF2F0',
    borderColor: '#F1CDCB',
  },
  adminBox: {
    backgroundColor: '#FAF5E8',
    borderColor: '#EFE0B8',
  },
  metricLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
  },
  metricValue: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.brand,
    lineHeight: 26,
  },
  metricSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
});
