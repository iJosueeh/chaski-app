import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Fonts } from "@/constants/theme";
import { TocapuStrip } from "@/features/wizard/components/wizard-ui";
import { AndeanTransitStamp } from "@/features/auth/components/andean-transit-stamp";
import { usePlaces } from "@/features/places/hooks";
import {
  PlaceEmptyState,
  PlaceErrorState,
  PlaceLoadingState,
  PlaceTicketCard,
} from "@/features/places/components";

const palette = Colors.light;

export function PlacesListScreen() {
  const insets = useSafeAreaInsets();
  const { places, loading, refreshing, errorKind, reload, refresh } =
    usePlaces();

  const errorMessage =
    errorKind === "service"
      ? "El servicio de destinos no respondió. Revisa tu conexión e inténtalo de nuevo."
      : errorKind === "network"
        ? "Sin conexión con el catálogo patrimonial. Vuelve a intentarlo en unos segundos."
        : null;

  const handleBack = () => router.back();
  const handleOpenPlace = (id: string) => router.push(`/place/${id}` as any);

  const countLabel =
    places.length === 1
      ? "1 destino activo"
      : `${places.length} destinos activos`;

  if (loading) {
    return (
      <View style={[styles.canvas, { backgroundColor: palette.background }]}>
        <PlaceLoadingState message="Consultando catálogo patrimonial…" />
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={[styles.canvas, { backgroundColor: palette.background }]}>
        <View
          style={[
            styles.stateWrapper,
            {
              paddingTop: Math.max(insets.top, 16) + 24,
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          <PlaceErrorState
            message={errorMessage}
            onRetry={reload}
            retryLabel="Reintentar"
            onBack={handleBack}
            backLabel="Volver"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16) + 8,
            backgroundColor: palette.surface,
            borderBottomColor: palette.border,
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Volver a la pantalla anterior"
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={handleBack}
          style={styles.backButton}
        >
          <Text style={[styles.backGlyph, { color: palette.brand }]}>‹</Text>
          <Text style={[styles.backText, { color: palette.brand }]}>
            Volver
          </Text>
        </TouchableOpacity>

        <View style={styles.kickerRow}>
          <View
            style={[styles.kickerBadge, { backgroundColor: palette.accent }]}
          >
            <Text style={[styles.kickerBadgeText, { color: palette.brand }]}>
              CATÁLOGO PATRIMONIAL
            </Text>
          </View>
          <Text style={[styles.seriesText, { color: palette.burgundy }]}>
            SERIE AX
          </Text>
        </View>

        <Text style={[styles.title, { color: palette.brand }]}>DESTINOS</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          {countLabel} · orden alfabético
        </Text>
      </View>
      <TocapuStrip />
      <FlatList
        data={places}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PlaceTicketCard
            place={item}
            onPress={() => handleOpenPlace(item.id)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom: insets.bottom + 32,
            justifyContent: places.length === 0 ? "center" : "flex-start",
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        }
        ListEmptyComponent={
          <PlaceEmptyState
            title="No hay destinos disponibles"
            description="El catálogo patrimonial no tiene registros activos por el momento. Vuelve más tarde o traza una ruta con el planificador de expediciones."
            actionLabel="Volver"
            onAction={handleBack}
          />
        }
        ListFooterComponent={
          places.length > 0 ? (
            <View style={styles.stampWrapper}>
              <AndeanTransitStamp
                compact={true}
                folio="SERIE AX · CATÁLOGO DE DESTINOS"
                station="RED DE ESTACIONES CHASKI"
                route="FICHAS PATRIMONIALES · LIMA"
              />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  stateWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    minHeight: 40,
    gap: 4,
  },
  backGlyph: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "700",
  },
  backText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  kickerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  kickerBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  seriesText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 0.4,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
    flexGrow: 1,
  },
  stampWrapper: {
    paddingTop: 20,
    alignItems: "center",
  },
});
