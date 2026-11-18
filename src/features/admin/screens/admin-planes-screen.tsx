/**
 * Pantalla de gestión de planes del panel de intendencia (Fase 1 · APF3).
 *
 * Lista las solicitudes de plan y las expediciones de TODOS los usuarios
 * (datos que la RLS bloquea a un usuario normal: solo accesibles por RPC de
 * administrador) y permite eliminar registros con confirmación explícita.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';

import { useAdminPlans } from '../hooks/use-admin-plans';
import type { AdminExpedicion, AdminSolicitud } from '../interfaces/admin.interface';
import { formatMobilityLabel, formatPlanDateTime } from '../utils/admin-plan-formatters';

type Vista = 'SOLICITUDES' | 'EXPEDICIONES';

export function AdminPlanesScreen() {
  const insets = useSafeAreaInsets();
  const [vista, setVista] = useState<Vista>('SOLICITUDES');
  const [busqueda, setBusqueda] = useState<string>('');
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const {
    solicitudes,
    expediciones,
    totalSolicitudes,
    totalExpediciones,
    loading,
    error,
    deletingId,
    reload,
    deleteSolicitud,
    deleteExpedicion,
  } = useAdminPlans({ search: busqueda, limit: 100 });

  const datos = useMemo(
    () => (vista === 'SOLICITUDES' ? solicitudes : expediciones),
    [vista, solicitudes, expediciones],
  );

  const handleEliminarSolicitud = useCallback(
    async (id: string) => {
      setMensaje(null);
      if (confirmandoId !== id) {
        setConfirmandoId(id);
        return;
      }
      setConfirmandoId(null);
      const result = await deleteSolicitud(id);
      setMensaje(
        result.success
          ? 'Solicitud eliminada.'
          : result.error ?? 'No fue posible eliminar la solicitud.',
      );
    },
    [confirmandoId, deleteSolicitud],
  );

  const handleEliminarExpedicion = useCallback(
    async (id: string) => {
      setMensaje(null);
      if (confirmandoId !== id) {
        setConfirmandoId(id);
        return;
      }
      setConfirmandoId(null);
      const result = await deleteExpedicion(id);
      setMensaje(
        result.success
          ? 'Expedición eliminada.'
          : result.error ?? 'No fue posible eliminar la expedición.',
      );
    },
    [confirmandoId, deleteExpedicion],
  );

  const renderSolicitud = ({ item }: { item: AdminSolicitud }) => {
    const confirmando = confirmandoId === item.id;
    return (
      <View style={styles.card} testID={`admin-solicitud-${item.id}`}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.usuario_nombre || 'Sin nombre'}</Text>
          <Text style={styles.cardBadge}>
            {formatMobilityLabel(item.movilidad)}
          </Text>
        </View>
        <Text style={styles.cardSubtitle}>{item.usuario_email}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>INICIO</Text>
          <Text style={styles.metaValue}>{formatPlanDateTime(item.fecha_hora_inicio)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>ORIGEN</Text>
          <Text style={styles.metaValue}>
            {item.inicio_descripcion ?? 'Ubicación GPS'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>INTERESES</Text>
          <Text style={styles.metaValue}>{item.categorias}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>PRESUPUESTO</Text>
          <Text style={styles.metaValue}>
            {item.gasto_max !== null ? `S/ ${item.gasto_max}` : 'No definido'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>EXPEDICIÓN</Text>
          <Text style={styles.metaValue}>{item.estado_expedicion ?? 'No iniciada'}</Text>
        </View>

        <Pressable
          testID={`admin-delete-solicitud-${item.id}`}
          style={[styles.deleteButton, confirmando && styles.deleteButtonConfirm]}
          onPress={() => void handleEliminarSolicitud(item.id)}
          disabled={deletingId === item.id}
          accessibilityRole="button"
          accessibilityLabel="Eliminar solicitud de plan"
        >
          {deletingId === item.id ? (
            <ActivityIndicator size="small" color={Colors.light.error} />
          ) : (
            <Text style={styles.deleteButtonText}>
              {confirmando ? '¿CONFIRMAR ELIMINACIÓN?' : 'ELIMINAR SOLICITUD'}
            </Text>
          )}
        </Pressable>
      </View>
    );
  };

  const renderExpedicion = ({ item }: { item: AdminExpedicion }) => {
    const confirmando = confirmandoId === item.solicitud_id;
    return (
      <View style={styles.card} testID={`admin-expedicion-${item.solicitud_id}`}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.titulo_plan}</Text>
          <Text style={styles.cardBadge}>{item.estado_expedicion}</Text>
        </View>
        <Text style={styles.cardSubtitle}>
          {item.usuario_nombre} · {item.usuario_email}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>COMPLETADO</Text>
          <Text style={styles.metaValue}>{formatPlanDateTime(item.completado_en)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>PARADAS VISITADAS</Text>
          <Text style={styles.metaValue}>
            {item.visitadas} de {item.total_paradas}
          </Text>
        </View>

        <Pressable
          testID={`admin-delete-expedicion-${item.solicitud_id}`}
          style={[styles.deleteButton, confirmando && styles.deleteButtonConfirm]}
          onPress={() => void handleEliminarExpedicion(item.solicitud_id)}
          disabled={deletingId === item.solicitud_id}
          accessibilityRole="button"
          accessibilityLabel="Eliminar expedición"
        >
          {deletingId === item.solicitud_id ? (
            <ActivityIndicator size="small" color={Colors.light.error} />
          ) : (
            <Text style={styles.deleteButtonText}>
              {confirmando ? '¿CONFIRMAR ELIMINACIÓN?' : 'ELIMINAR EXPEDICIÓN'}
            </Text>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.canvas, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al panel"
          testID="admin-planes-back"
        >
          <Text style={styles.backButtonText}>← VOLVER</Text>
        </Pressable>
        <Text style={styles.headerTitle}>GESTIÓN DE PLANES</Text>
        <Text style={styles.headerSubtitle}>
          Solicitudes y expediciones de todos los exploradores
        </Text>
      </View>

      <View style={styles.segmentRow}>
        <Pressable
          testID="admin-tab-solicitudes"
          style={[styles.segment, vista === 'SOLICITUDES' && styles.segmentActive]}
          onPress={() => {
            setVista('SOLICITUDES');
            setConfirmandoId(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Ver solicitudes de plan"
        >
          <Text
            style={[
              styles.segmentText,
              vista === 'SOLICITUDES' && styles.segmentTextActive,
            ]}
          >
            SOLICITUDES ({totalSolicitudes})
          </Text>
        </Pressable>

        <Pressable
          testID="admin-tab-expediciones"
          style={[styles.segment, vista === 'EXPEDICIONES' && styles.segmentActive]}
          onPress={() => {
            setVista('EXPEDICIONES');
            setConfirmandoId(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Ver expediciones"
        >
          <Text
            style={[
              styles.segmentText,
              vista === 'EXPEDICIONES' && styles.segmentTextActive,
            ]}
          >
            EXPEDICIONES ({totalExpediciones})
          </Text>
        </Pressable>
      </View>

      <TextInput
        testID="admin-planes-search"
        style={styles.searchInput}
        value={busqueda}
        onChangeText={setBusqueda}
        placeholder="Buscar por usuario, correo o lugar"
        placeholderTextColor={Colors.light.textSecondary}
        accessibilityLabel="Buscar planes"
      />

      {!!mensaje && (
        <View style={styles.messageBox} testID="admin-planes-message">
          <Text style={styles.messageText}>{mensaje}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.stateText}>Consultando planes...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>No fue posible cargar los planes</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void reload()}
            accessibilityRole="button"
            accessibilityLabel="Reintentar carga de planes"
          >
            <Text style={styles.retryButtonText}>REINTENTAR</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={datos as (AdminSolicitud | AdminExpedicion)[]}
          keyExtractor={(item) =>
            vista === 'SOLICITUDES'
              ? (item as AdminSolicitud).id
              : (item as AdminExpedicion).solicitud_id
          }
          renderItem={({ item }) =>
            vista === 'SOLICITUDES' ? (
              renderSolicitud({ item: item as AdminSolicitud })
            ) : (
              renderExpedicion({ item: item as AdminExpedicion })
            )
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centered} testID="admin-planes-empty">
              <Text style={styles.stateText}>
                {vista === 'SOLICITUDES'
                  ? 'Todavía no hay solicitudes registradas.'
                  : 'Todavía no hay expediciones registradas.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 16,
  },
  header: {
    gap: 4,
    marginBottom: 10,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.light.textSecondary,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: Colors.light.brand,
  },
  headerSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  segmentText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.light.textSecondary,
  },
  segmentTextActive: {
    color: Colors.light.surface,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.text,
    backgroundColor: Colors.light.surface,
    marginBottom: 10,
  },
  listContent: {
    paddingBottom: 40,
    gap: 10,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontFamily: Fonts.display,
    fontSize: 15,
    color: Colors.light.brand,
  },
  cardBadge: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.light.carmine,
  },
  cardSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: Colors.light.textSecondary,
  },
  metaValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.light.text,
  },
  deleteButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.light.error,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  deleteButtonConfirm: {
    backgroundColor: Colors.light.backgroundElement,
  },
  deleteButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.light.error,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  stateText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  errorTitle: {
    fontFamily: Fonts.display,
    fontSize: 14,
    color: Colors.light.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.accent,
  },
  retryButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.brand,
    letterSpacing: 0.6,
  },
  messageBox: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  messageText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.light.text,
  },
});
