import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import type { Place } from "@/features/places/interface/places.interface";
import {
  formatPlaceBudget,
  formatPlaceDuration,
  formatPlaceFolio,
  getPlaceCategoryNames,
  getPlacePhotoAlt,
  getPlacePrimaryCategory,
} from "@/features/places/utils/places-formatters";

import { PlacePhoto } from "./place-photo";

const palette = Colors.light;

export interface PlaceTicketCardProps {
  place: Place;
  onPress: () => void;
}

export function PlaceTicketCard({ place, onPress }: PlaceTicketCardProps) {
  const budget = formatPlaceBudget(place.gasto_min, place.gasto_max);
  const duration = formatPlaceDuration(place.duracion_sugerida_min);
  const folio = formatPlaceFolio(place.id);
  const primaryCategory = getPlacePrimaryCategory(place.categorias);
  const categories = getPlaceCategoryNames(place.categorias, 3);
  const photoCount = place.imagenes?.length ?? 0;

  const accessibilityLabel = [
    place.nombre,
    `categoría ${primaryCategory}`,
    budget.label,
    duration ? `duración sugerida ${duration}` : null,
    "ver ficha del destino",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Abre la ficha completa del destino"
      style={styles.touchable}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      >
        <View style={[styles.topAccent, { backgroundColor: palette.accent }]} />
        <View style={styles.photoWrap}>
          <PlacePhoto
            uri={place.imagen_portada}
            alt={getPlacePhotoAlt(place.nombre)}
            variant="thumb"
          />
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: palette.accent, borderColor: palette.brand },
            ]}
          >
            <Text style={[styles.categoryBadgeText, { color: palette.brand }]}>
              {primaryCategory.toUpperCase()}
            </Text>
          </View>
          {photoCount > 0 && (
            <View
              style={[
                styles.photoCount,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.photoCountText,
                  { color: palette.textSecondary },
                ]}
              >
                {photoCount} {photoCount === 1 ? "FOTO" : "FOTOS"}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          <View style={styles.folioRow}>
            <Text style={[styles.folioText, { color: palette.primary }]}>
              FOLIO {folio}
            </Text>
            <Text style={[styles.serieText, { color: palette.textSecondary }]}>
              SERIE AX
            </Text>
          </View>
          <Text
            style={[styles.title, { color: palette.brand }]}
            numberOfLines={2}
          >
            {place.nombre}
          </Text>
          {place.direccion ? (
            <Text
              style={[styles.address, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              {place.direccion}
            </Text>
          ) : null}
          {categories.length > 0 && (
            <View style={styles.chips}>
              {categories.map((category) => (
                <View
                  key={category}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: palette.backgroundElement,
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
          )}
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
        <View style={styles.stub}>
          <View style={styles.stubItem}>
            <Text style={[styles.stubLabel, { color: palette.textSecondary }]}>
              PRESUPUESTO
            </Text>
            <Text
              style={[
                styles.stubValue,
                { color: budget.isFree ? palette.success : palette.primary },
              ]}
              numberOfLines={1}
            >
              {budget.label}
            </Text>
          </View>
          <View
            style={[styles.stubDivider, { backgroundColor: palette.border }]}
          />
          <View style={styles.stubItem}>
            <Text style={[styles.stubLabel, { color: palette.textSecondary }]}>
              DURACIÓN
            </Text>
            <Text
              style={[styles.stubValue, { color: palette.brand }]}
              numberOfLines={1}
            >
              {duration ?? "A tu ritmo"}
            </Text>
          </View>
          <Text style={[styles.stubCta, { color: palette.primary }]}>
            FICHA →
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    width: "100%",
  },
  card: {
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: "hidden",
    shadowColor: palette.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  topAccent: {
    height: 4,
    width: "100%",
  },
  photoWrap: {
    position: "relative",
  },
  categoryBadge: {
    position: "absolute",
    top: 10,
    left: 10,
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
  photoCount: {
    position: "absolute",
    right: 10,
    bottom: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
  },
  photoCountText: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 6,
  },
  folioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  folioText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  serieText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  address: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: Fonts.sans,
    fontSize: 10.5,
    fontWeight: "600",
  },
  perforationWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  notchLeft: {
    width: 14,
    height: 22,
    borderTopRightRadius: 11,
    borderBottomRightRadius: 11,
  },
  perforationLine: {
    flex: 1,
    height: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
    marginHorizontal: 4,
  },
  notchRight: {
    width: 14,
    height: 22,
    borderTopLeftRadius: 11,
    borderBottomLeftRadius: 11,
  },
  stub: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stubItem: {
    flexShrink: 1,
    gap: 1,
  },
  stubLabel: {
    fontFamily: Fonts.mono,
    fontSize: 7.5,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  stubValue: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  stubDivider: {
    width: 1,
    height: 26,
  },
  stubCta: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginLeft: "auto",
  },
});
