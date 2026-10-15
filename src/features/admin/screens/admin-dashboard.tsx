import { useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Fonts } from "@/constants/theme";
import { useAuth } from "@/features/auth/context/auth-context";
import {
  useAdminMetrics,
  useAdminUsers,
  useAdminStatusManager,
} from "../hooks";
import type { AdminUser } from "../interfaces/admin.interface";
import {
  AdminHeader,
  AdminMetricsCard,
  AdminFilters,
  AdminUserCard,
  AdminUserDetailModal,
} from "../components";

export function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAdmin, profileLoading, accountStatus, refreshUserProfile } =
    useAuth();

  // Hooks de datos administrativos
  const {
    metrics,
    loading: metricsLoading,
    error: metricsError,
    reloadMetrics,
  } = useAdminMetrics();

  const {
    users,
    totalCount,
    loading: usersLoading,
    error: usersError,
    currentPage,
    totalPages,
    hasMore,
    search,
    setSearch,
    filtroRol,
    setFiltroRol,
    filtroEstado,
    setFiltroEstado,
    setPage,
    refetch: refetchUsers,
  } = useAdminUsers();

  const { isUpdating, setUserStatus } = useAdminStatusManager();

  // Estados locales para detalle y modal
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([reloadMetrics(), refetchUsers()]);
    setRefreshing(false);
  }, [reloadMetrics, refetchUsers]);

  const handleOpenDetail = useCallback((targetUser: AdminUser) => {
    setSelectedUser(targetUser);
    setDetailModalVisible(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailModalVisible(false);
    setSelectedUser(null);
  }, []);

  const handleStatusChange = useCallback(
    async (userId: string, newStatus: boolean) => {
      const result = await setUserStatus(userId, newStatus);
      if (result.success) {
        // Actualizar el usuario seleccionado en el modal local
        setSelectedUser((prev) =>
          prev ? { ...prev, estado: newStatus } : null,
        );
        // Recargar lista y métricas en segundo plano
        reloadMetrics();
        refetchUsers();
      }
      return result;
    },
    [setUserStatus, reloadMetrics, refetchUsers],
  );

  const handleResetFilters = useCallback(() => {
    setSearch("");
    setFiltroRol(null);
    setFiltroEstado(null);
  }, [setSearch, setFiltroRol, setFiltroEstado]);

  // Estado de carga de autorización
  if (profileLoading) {
    return (
      <View
        style={[
          styles.canvas,
          styles.centeredContent,
          { paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingTitle}>VERIFICANDO CREDENCIALES</Text>
        <Text style={styles.loadingSubtitle}>
          Comprobando privilegios de intendencia...
        </Text>
      </View>
    );
  }

  // Estado de error de red al consultar perfil
  if (accountStatus === "error_red") {
    return (
      <View
        style={[
          styles.canvas,
          styles.centeredContent,
          { paddingTop: insets.top },
        ]}
      >
        <View style={styles.guardCard}>
          <Text style={styles.guardIcon}>⚠️</Text>
          <Text style={styles.guardTitle}>ERROR DE CONEXIÓN</Text>
          <Text style={styles.guardSubtitle}>
            No fue posible validar tus credenciales debido a un problema de
            conexión con el servidor.
          </Text>
          <Pressable
            style={styles.guardButton}
            onPress={refreshUserProfile}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Reintentar verificación de credenciales"
          >
            <Text style={styles.guardButtonText}>REINTENTAR CONEXIÓN</Text>
          </Pressable>
          <Pressable
            style={styles.guardSecondaryButton}
            onPress={() => router.back()}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Volver al Perfil"
          >
            <Text style={styles.guardSecondaryButtonText}>VOLVER</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 3. Estado de acceso denegado si no es ADMIN confirmado
  if (!isAdmin) {
    return (
      <View
        style={[
          styles.canvas,
          styles.centeredContent,
          { paddingTop: insets.top },
        ]}
      >
        <View style={styles.guardCard} testID="admin-access-denied-card">
          <Text style={styles.guardIcon}>🛡️</Text>
          <Text style={styles.guardTitle}>ACCESO RESTRINGIDO</Text>
          <Text style={styles.guardSubtitle}>
            Se requieren privilegios de Intendencia (ADMIN) para acceder al
            padrón institucional.
          </Text>
          <Pressable
            style={styles.guardButton}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)/perfil");
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Volver a la pantalla de Perfil"
            testID="admin-denied-back-button"
          >
            <Text style={styles.guardButtonText}>VOLVER AL PERFIL</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 4. Panel administrativo confirmado
  return (
    <View
      style={[
        styles.canvas,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <AdminUserCard
            user={item}
            isCurrentUser={item.id === user?.id}
            onPress={handleOpenDetail}
          />
        )}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            <AdminHeader
              onBack={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/(tabs)/perfil");
              }}
              onRefresh={handleRefreshAll}
              refreshing={refreshing}
            />

            {/* Aviso especial si la migración de base de datos aún no está desplegada */}
            {(usersError?.includes("aún no han sido desplegadas") ||
              metricsError?.includes("aún no han sido desplegadas")) && (
              <View
                style={styles.migrationNoticeBox}
                testID="admin-migration-notice"
              >
                <Text style={styles.migrationNoticeTitle}>
                  ⚙️ MIGRACIÓN SQL PENDIENTE EN SERVIDOR
                </Text>
                <Text style={styles.migrationNoticeText}>
                  Las funciones RPC administrativas no están disponibles aún en
                  la base de datos remota. Ejecuta la migración correspondiente
                  para habilitar la sincronización real.
                </Text>
              </View>
            )}

            {/* Tablero de métricas */}
            <AdminMetricsCard
              metrics={metrics}
              loading={metricsLoading}
              error={metricsError}
              onRetry={reloadMetrics}
            />

            {/* Buscador y filtros */}
            <AdminFilters
              search={search}
              onSearchChange={setSearch}
              filtroRol={filtroRol}
              onRolChange={setFiltroRol}
              filtroEstado={filtroEstado}
              onEstadoChange={setFiltroEstado}
              onResetFilters={handleResetFilters}
            />

            {/* Encabezado del listado */}
            <View style={styles.listSectionHeader}>
              <Text style={styles.listSectionTitle}>
                PADRÓN DE EXPLORADORES
              </Text>
              <Text style={styles.listSectionCounter}>
                {totalCount} {totalCount === 1 ? "resultado" : "resultados"}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer} testID="admin-empty-list">
            {usersLoading ? (
              <View style={styles.loadingListWrapper}>
                <ActivityIndicator size="small" color={Colors.light.accent} />
                <Text style={styles.loadingListText}>
                  Consultando padrón de usuarios...
                </Text>
              </View>
            ) : usersError ? (
              <View style={styles.errorListWrapper}>
                <Text style={styles.errorListTitle}>
                  No fue posible consultar el padrón
                </Text>
                <Text style={styles.errorListText}>{usersError}</Text>
                <Pressable
                  style={styles.retryListButton}
                  onPress={refetchUsers}
                  accessible={true}
                  accessibilityRole="button"
                >
                  <Text style={styles.retryListButtonText}>REINTENTAR</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.noResultsWrapper}>
                <Text style={styles.noResultsIcon}>🔍</Text>
                <Text style={styles.noResultsTitle}>
                  Sin resultados en el padrón
                </Text>
                <Text style={styles.noResultsText}>
                  No se encontraron usuarios que coincidan con los filtros o
                  término de búsqueda.
                </Text>
                {(search || filtroRol !== null || filtroEstado !== null) && (
                  <Pressable
                    style={styles.clearFiltersButton}
                    onPress={handleResetFilters}
                    accessible={true}
                    accessibilityRole="button"
                  >
                    <Text style={styles.clearFiltersButtonText}>
                      RESTAURAR FILTROS
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          users.length > 0 ? (
            <View
              style={styles.paginationFooter}
              testID="admin-pagination-footer"
            >
              <Pressable
                style={[
                  styles.pageButton,
                  currentPage === 0 && styles.pageButtonDisabled,
                ]}
                onPress={() => setPage(currentPage - 1)}
                disabled={currentPage === 0 || usersLoading}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Página anterior"
                testID="admin-prev-page-button"
              >
                <Text
                  style={[
                    styles.pageButtonText,
                    currentPage === 0 && styles.pageButtonTextDisabled,
                  ]}
                >
                  ‹ ANTERIOR
                </Text>
              </Pressable>

              <Text style={styles.pageInfoText}>
                Pág. {currentPage + 1} de {Math.max(1, totalPages)}
              </Text>

              <Pressable
                style={[
                  styles.pageButton,
                  (!hasMore || currentPage >= totalPages - 1) &&
                    styles.pageButtonDisabled,
                ]}
                onPress={() => setPage(currentPage + 1)}
                disabled={
                  !hasMore || currentPage >= totalPages - 1 || usersLoading
                }
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Página siguiente"
                testID="admin-next-page-button"
              >
                <Text
                  style={[
                    styles.pageButtonText,
                    (!hasMore || currentPage >= totalPages - 1) &&
                      styles.pageButtonTextDisabled,
                  ]}
                >
                  SIGUIENTE ›
                </Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      {/* Modal de Detalle y Activación/Desactivación */}
      <AdminUserDetailModal
        user={selectedUser}
        visible={detailModalVisible}
        onClose={handleCloseDetail}
        currentUserId={user?.id ?? null}
        onStatusChange={handleStatusChange}
        isUpdating={isUpdating}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },
  centeredContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingTitle: {
    marginTop: 16,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.accent,
    letterSpacing: 1,
  },
  loadingSubtitle: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  guardCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  guardIcon: {
    fontSize: 36,
  },
  guardTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.brand,
    letterSpacing: 0.5,
  },
  guardSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  guardButton: {
    marginTop: 8,
    width: "100%",
    height: 44,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  guardButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  guardSecondaryButton: {
    width: "100%",
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  guardSecondaryButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
  },
  headerArea: {
    marginBottom: 8,
  },
  migrationNoticeBox: {
    backgroundColor: "#FAF5E8",
    borderColor: "#EFE0B8",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    gap: 4,
  },
  migrationNoticeTitle: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: "700",
    color: Colors.light.accent,
    letterSpacing: 0.5,
  },
  migrationNoticeText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.brand,
    lineHeight: 16,
  },
  listSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  listSectionTitle: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: "700",
    color: Colors.light.brand,
    letterSpacing: 0.8,
  },
  listSectionCounter: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: "center",
  },
  loadingListWrapper: {
    alignItems: "center",
    gap: 10,
  },
  loadingListText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  errorListWrapper: {
    alignItems: "center",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    gap: 8,
    maxWidth: 400,
  },
  errorListTitle: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.carmine,
  },
  errorListText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 16,
  },
  retryListButton: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  retryListButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: "700",
    color: Colors.light.primary,
  },
  noResultsWrapper: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
  },
  noResultsIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  noResultsTitle: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.brand,
  },
  noResultsText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 16,
  },
  clearFiltersButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.accent,
    backgroundColor: "#FAF3E3",
  },
  clearFiltersButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: "700",
    color: Colors.light.brand,
    letterSpacing: 0.5,
  },
  paginationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  pageButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  pageButtonDisabled: {
    opacity: 0.35,
  },
  pageButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: "700",
    color: Colors.light.brand,
    letterSpacing: 0.5,
  },
  pageButtonTextDisabled: {
    color: Colors.light.textSecondary,
  },
  pageInfoText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
});
