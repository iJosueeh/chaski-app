/**
 * Pantalla de auditoría de intendencia (Fase 1.5 · APF3).
 *
 * Muestra dos cosas: los números de uso de la aplicación y el historial de lo
 * que hicieron los administradores. El historial lo llena la base de datos con
 * disparadores, no la aplicación, así que no se puede falsear desde el cliente.
 */

import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';

import { useAdminAuditoria } from '../hooks/use-admin-auditoria';
import type { AdminAccion } from '../interfaces/admin.interface';
import {
  formatAuditActionLabel,
  isDestructiveAuditAction,
  summarizeAuditDetail,
} from '../utils/admin-audit-formatters';
import { formatPlanDateTime } from '../utils/admin-plan-formatters';

interface MetricaTile {
  etiqueta: string;
  valor: number;
}

/** Tarjeta del historial: quién hizo qué y cuándo. */
function AccionCard({ accion }: { accion: AdminAccion }) {
  const esDestructiva = isDestructiveAuditAction(accion.accion);

  return (
    <View style={styles.card} testID={`admin-audit-card-${accion.id}`}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.badge,
            esDestructiva ? styles.badgeDanger : styles.badgeNeutral,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              esDestructiva ? styles.badgeTextDanger : styles.badgeTextNeutral,
            ]}
          >
            {formatAuditActionLabel(accion.accion)}
          </Text>
        </View>
        <Text style={styles.cardDate}>{formatPlanDateTime(accion.creado_en)}</Text>
      </View>

      <Text style={styles.cardActor} numberOfLines={1}>
        {accion.actor_nombre || 'Administrador'}
        {accion.actor_email ? ` · ${accion.actor_email}` : ''}
      </Text>

      <Text style={styles.cardDetail}>
        {summarizeAuditDetail(accion.accion, accion.detalle)}
      </Text>

      <Text style={styles.cardTarget}>
        Sobre: {accion.objetivo_tipo || 'registro'}
        {accion.objetivo_id ? ` ${accion.objetivo_id.slice(0, 8)}` : ''}
      </Text>
    </View>
  );
}

export function AdminAuditoriaScreen() {
  const insets = useSafeAreaInsets();
  const {
    acciones,
    metrics,
    totalCount,
    page,
    totalPages,
    loading,
    error,
    reload,
    goToPreviousPage,
    goToNextPage,
  } = useAdminAuditoria();

  const tiles: MetricaTile[] = [
    { etiqueta: 'SOLICITUDES', valor: metrics?.solicitudes_total ?? 0 },
    { etiqueta: 'EXPEDICIONES', valor: metrics?.expediciones_total ?? 0 },
    { etiqueta: 'COMPLETADAS', valor: metrics?.expediciones_completadas ?? 0 },
    { etiqueta: 'PARADAS VISITADAS', valor: metrics?.paradas_visitadas_total ?? 0 },
    { etiqueta: 'DESTINOS ACTIVOS', valor: metrics?.lugares_activos ?? 0 },
    { etiqueta: 'CON PORTADA', valor: metrics?.lugares_con_portada ?? 0 },
  ];

  const encabezado = (
    <View>
      <Text style={styles.sectionLabel}>USO DE LA APLICACIÓN</Text>
      <View style={styles.metricsGrid}>
        {tiles.map((tile) => (
          <View key={tile.etiqueta} style={styles.metricTile}>
            <Text style={styles.metricValue}>{tile.valor}</Text>
            <Text style={styles.metricLabel}>{tile.etiqueta}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>HISTORIAL DE ACCIONES — {totalCount}</Text>

      {error ? (
        <View style={styles.errorBox} testID="admin-audit-error">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  const pie = (
    <View style={styles.pagination}>
      <Pressable
        onPress={goToPreviousPage}
        disabled={page <= 1 || loading}
        style={[styles.pageButton, (page <= 1 || loading) && styles.pageButtonOff]}
        accessibilityRole="button"
        accessibilityLabel="Página anterior"
      >
        <Text style={styles.pageButtonText}>‹ ANTERIOR</Text>
      </Pressable>

      <Text style={styles.pageLabel}>
        Pág. {page} de {totalPages}
      </Text>

      <Pressable
        onPress={goToNextPage}
        disabled={page >= totalPages || loading}
        style={[styles.pageButton, (page >= totalPages || loading) && styles.pageButtonOff]}
        accessibilityRole="button"
        accessibilityLabel="Página siguiente"
      >
        <Text style={styles.pageButtonText}>SIGUIENTE ›</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al panel"
          testID="admin-audit-back-button"
        >
          <Text style={styles.topButton}>VOLVER</Text>
        </Pressable>

        <View style={styles.topTitleBlock}>
          <Text style={styles.topKicker}>SERIE AX · GESTIÓN INSTITUCIONAL</Text>
          <Text style={styles.topTitle}>AUDITORÍA</Text>
        </View>

        <Pressable
          onPress={() => void reload()}
          accessibilityRole="button"
          accessibilityLabel="Actualizar auditoría"
          testID="admin-audit-refresh-button"
        >
          <Text style={styles.topButton}>ACTUALIZAR</Text>
        </Pressable>
      </View>

      {loading && acciones.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.light.primary} />
          <Text style={styles.loadingText}>Leyendo el historial…</Text>
        </View>
      ) : (
        <FlatList
          data={acciones}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AccionCard accion={item} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={encabezado}
          ListFooterComponent={pie}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Todavía no hay acciones registradas. Edita un usuario o elimina un
              plan y volverá a aparecer aquí.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 12,
  },
  topButton: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.primary,
    letterSpacing: 0.8,
  },
  topTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  topKicker: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 1.1,
    color: Colors.light.textSecondary,
  },
  topTitle: {
    fontFamily: Fonts.display,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  listContent: {
    paddingBottom: 32,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginTop: 8,
    marginBottom: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metricTile: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  metricValue: {
    fontFamily: Fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  metricLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 0.7,
    color: Colors.light.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeNeutral: {
    backgroundColor: Colors.light.backgroundElement,
    borderColor: Colors.light.border,
  },
  badgeDanger: {
    backgroundColor: Colors.light.backgroundElement,
    borderColor: Colors.light.carmine,
  },
  badgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeTextNeutral: {
    color: Colors.light.textSecondary,
  },
  badgeTextDanger: {
    color: Colors.light.carmine,
  },
  cardDate: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.light.textSecondary,
  },
  cardActor: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
  },
  cardDetail: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  cardTarget: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.light.textSecondary,
    marginTop: 6,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  errorBox: {
    backgroundColor: Colors.light.backgroundElement,
    borderColor: Colors.light.error,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.error,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  pageButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  pageButtonOff: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.text,
  },
  pageLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
});
