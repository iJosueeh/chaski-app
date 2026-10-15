import { type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Fonts } from "@/constants/theme";
import { TocapuStrip } from "@/features/wizard/components/wizard-ui";
import { formatMapCoordinates } from "@/features/wizard/constants/wizard-map";
import { AndeanTransitStamp } from "@/features/auth/components/andean-transit-stamp";
import { usePlace, type PlaceErrorKind } from "@/features/places/hooks";
import {
  PlaceErrorState,
  PlaceLoadingState,
  PlacePhoto,
} from "@/features/places/components";
import {
  formatPlaceBudget,
  formatPlaceDuration,
  formatPlaceFolio,
  getPlaceCategoryNames,
  getPlacePhotoAlt,
  getPlacePrimaryCategory,
} from "@/features/places/utils/places-formatters";
import { PriceRange, ScheduleDisplay } from "@/shared";

const palette = Colors.light;

const PLACE_ERROR_MESSAGES: Record<PlaceErrorKind, string> = {
  missingId: "Este destino no está disponible en el catálogo.",
  service:
    "No pudimos consultar la ficha del destino. Revisa tu conexión e inténtalo de nuevo.",
  notFound: "Este destino ya no está disponible en el catálogo activo.",
  network:
    "Sin conexión con el catálogo patrimonial. Vuelve a intentarlo en unos segundos.",
};

function DetailSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelRow}>
        <View
          style={[styles.sectionLabelRule, { backgroundColor: palette.accent }]}
        />
        <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}

export function PlaceDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { place, loading: isLoading, errorKind, reload } = usePlace(id);

  const handleBack = () => router.back();

  const effectiveError = errorKind ? PLACE_ERROR_MESSAGES[errorKind] : null;

  if (isLoading) {
    return (
      <View style={[styles.canvas, { backgroundColor: palette.background }]}>
        <PlaceLoadingState message="Consultando ficha del destino…" />
      </View>
    );
  }

  if (effectiveError || !place) {
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
            title="Ficha no disponible"
            message={effectiveError || "Lugar no encontrado"}
            onRetry={id ? reload : undefined}
            retryLabel="Reintentar"
            onBack={handleBack}
            backLabel="Volver"
          />
        </View>
      </View>
    );
  }

  const folio = formatPlaceFolio(place.id);
  const budget = formatPlaceBudget(place.gasto_min, place.gasto_max);
  const duration = formatPlaceDuration(place.duracion_sugerida_min);
  const primaryCategory = getPlacePrimaryCategory(place.categorias);
  const categorias = getPlaceCategoryNames(place.categorias, 12);
  const etiquetas = place.etiquetas.map((tag) => tag.nombre).filter(Boolean);
  const coordinates = formatMapCoordinates(place.latitud, place.longitud);

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 16) + 6,
            backgroundColor: palette.surface,
            borderBottomColor: palette.border,
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Volver al catálogo de destinos"
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

        <View style={styles.topBarMeta}>
          <Text style={[styles.topBarFolio, { color: palette.primary }]}>
            FOLIO {folio}
          </Text>
          <Text style={[styles.topBarSeries, { color: palette.textSecondary }]}>
            SERIE AX · FICHA DE DESTINO
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PlacePhoto
          uri={place.imagen_portada}
          alt={getPlacePhotoAlt(place.nombre)}
          variant="hero"
        />
        <View style={styles.identity}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: palette.accent, borderColor: palette.brand },
              ]}
            >
              <Text
                style={[styles.categoryBadgeText, { color: palette.brand }]}
              >
                {primaryCategory.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.serieText, { color: palette.burgundy }]}>
              DESTINO ACTIVO
            </Text>
          </View>
          <Text style={[styles.title, { color: palette.brand }]}>
            {place.nombre}
          </Text>
          <Text style={[styles.address, { color: palette.textSecondary }]}>
            {place.direccion ?? "Dirección no registrada"}
          </Text>
          {place.descripcion ? (
            <Text
              style={[styles.description, { color: palette.textSecondary }]}
            >
              {place.descripcion}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.metaGrid,
            {
              backgroundColor: palette.backgroundElement,
              borderColor: palette.border,
            },
          ]}
        >
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>
              PRESUPUESTO
            </Text>
            <PriceRange min={place.gasto_min} max={place.gasto_max} />
          </View>
          <View
            style={[styles.metaDivider, { backgroundColor: palette.border }]}
          />
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>
              DURACIÓN
            </Text>
            <Text
              style={[
                styles.metaValue,
                { color: duration ? palette.brand : palette.textSecondary },
              ]}
            >
              {duration ?? "A tu ritmo"}
            </Text>
          </View>
          <View
            style={[styles.metaDivider, { backgroundColor: palette.border }]}
          />
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>
              SERIE
            </Text>
            <Text style={[styles.metaValue, { color: palette.primary }]}>
              {folio}
            </Text>
          </View>
        </View>
        <View style={styles.perforationWrapper} accessible={false}>
          <View
            style={[styles.notchLeft, { backgroundColor: palette.background }]}
          />
          <View
            style={[styles.perforationLine, { borderColor: palette.border }]}
          />
          <View
            style={[styles.notchRight, { backgroundColor: palette.background }]}
          />
        </View>
        <DetailSection label="UBICACIÓN">
          <Text style={[styles.coordinates, { color: palette.textSecondary }]}>
            {coordinates}
          </Text>
          {!place.direccion && (
            <Text style={[styles.emptyNote, { color: palette.textSecondary }]}>
              Dirección no registrada
            </Text>
          )}
        </DetailSection>
        <DetailSection label="CATEGORÍAS">
          {categorias.length > 0 ? (
            <View style={styles.chips}>
              {categorias.map((category) => (
                <View
                  key={category}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: palette.brand }]}>
                    {category}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyNote, { color: palette.textSecondary }]}>
              Sin categorías registradas
            </Text>
          )}
        </DetailSection>
        <DetailSection label="ETIQUETAS">
          {etiquetas.length > 0 ? (
            <View style={styles.chips}>
              {etiquetas.map((tag) => (
                <View
                  key={tag}
                  style={[
                    styles.chip,
                    styles.chipTag,
                    { borderColor: palette.primary },
                  ]}
                >
                  <Text style={[styles.chipText, { color: palette.primary }]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyNote, { color: palette.textSecondary }]}>
              Sin etiquetas registradas
            </Text>
          )}
        </DetailSection>
        <DetailSection label="HORARIOS">
          <View
            style={[
              styles.scheduleCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <ScheduleDisplay horarios={place.horarios} />
          </View>
        </DetailSection>
        <DetailSection label="PRESUPUESTO">
          <View
            style={[
              styles.budgetCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text
              style={[
                styles.budgetValue,
                { color: budget.isFree ? palette.success : palette.primary },
              ]}
            >
              {budget.label}
            </Text>
            <Text style={[styles.budgetNote, { color: palette.textSecondary }]}>
              {budget.isFree
                ? "Acceso sin costo de entrada registrado."
                : "Rango referencial por persona reportado en el catálogo."}
            </Text>
          </View>
        </DetailSection>
        <View style={styles.footer}>
          <AndeanTransitStamp
            compact={true}
            folio={`SERIE AX · ${folio}`}
            station="FICHA PATRIMONIAL CHASKI"
            route="CONTROL DE VISITA · LIMA"
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Volver al catálogo de destinos"
            activeOpacity={0.85}
            onPress={handleBack}
            style={[
              styles.ctaButton,
              { backgroundColor: palette.primary, borderColor: palette.brand },
            ]}
          >
            <View style={styles.ctaInnerBorder} />
            <Text style={[styles.ctaText, { color: palette.surface }]}>
              VOLVER AL CATÁLOGO
            </Text>
          </TouchableOpacity>
        </View>
        <TocapuStrip />
      </ScrollView>
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
  topBar: {
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    gap: 6,
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
  topBarMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarFolio: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  topBarSeries: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 1,
  },
  content: {
    gap: 18,
  },
  identity: {
    paddingHorizontal: 20,
    gap: 6,
    marginTop: -6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 2,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  serieText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
    letterSpacing: 0.4,
  },
  address: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  description: {
    fontFamily: Fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 4,
  },
  metaGrid: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  metaItem: {
    flex: 1,
    alignItems: "flex-start",
    gap: 3,
    paddingRight: 6,
  },
  metaDivider: {
    width: 1,
    height: 30,
    marginHorizontal: 6,
  },
  metaLabel: {
    fontFamily: Fonts.mono,
    fontSize: 7.5,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  metaValue: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: "700",
  },
  perforationWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: -4,
  },
  notchLeft: {
    width: 16,
    height: 24,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  perforationLine: {
    flex: 1,
    height: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
    marginHorizontal: 4,
  },
  notchRight: {
    width: 16,
    height: 24,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  section: {
    paddingHorizontal: 20,
    gap: 8,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionLabelRule: {
    width: 24,
    height: 1.5,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  coordinates: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipTag: {
    backgroundColor: "transparent",
  },
  chipText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: "600",
  },
  emptyNote: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    fontStyle: "italic",
  },
  scheduleCard: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  budgetCard: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  budgetValue: {
    fontFamily: Fonts.mono,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  budgetNote: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  ctaButton: {
    width: "100%",
    minHeight: 50,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ctaInnerBorder: {
    position: "absolute",
    top: 2,
    bottom: 2,
    left: 2,
    right: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 253, 249, 0.3)",
  },
  ctaText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
});
