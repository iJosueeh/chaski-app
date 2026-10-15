import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";

import { Colors, Fonts } from "@/constants/theme";

const palette = Colors.light;

export type PlacePhotoVariant = "thumb" | "hero";

export interface PlacePhotoProps {
  uri?: string | null;
  alt: string;
  variant?: PlacePhotoVariant;
  style?: StyleProp<ViewStyle>;
}

function PlaceholderTocapu() {
  return (
    <View
      style={styles.tocapu}
      accessible={false}
      importantForAccessibility="no"
    >
      {Array.from({ length: 9 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.tocapuSeg,
            {
              backgroundColor:
                index % 3 === 0
                  ? palette.accent
                  : index % 3 === 1
                    ? palette.backgroundSelected
                    : "rgba(156, 62, 27, 0.3)",
            },
          ]}
        />
      ))}
    </View>
  );
}

export function PlacePhoto({
  uri,
  alt,
  variant = "thumb",
  style,
}: PlacePhotoProps) {
  const [failed, setFailed] = useState(false);
  const hasImage = Boolean(uri) && !failed;
  const isHero = variant === "hero";

  return (
    <View
      style={[styles.container, isHero ? styles.hero : styles.thumb, style]}
      accessibilityRole="image"
      accessibilityLabel={alt}
    >
      {hasImage ? (
        <Image
          source={{ uri: uri as string }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          placeholderContentFit="cover"
          transition={250}
          alt={alt}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[styles.placeholder, isHero && styles.placeholderHero]}>
          <View
            style={[
              styles.diamondOuter,
              isHero && styles.diamondOuterHero,
              { borderColor: palette.accent },
            ]}
            accessible={false}
          >
            <View
              style={[
                styles.diamondInner,
                isHero && styles.diamondInnerHero,
                { borderColor: palette.primary },
              ]}
            />
            <View
              style={[
                styles.diamondDot,
                isHero && styles.diamondDotHero,
                { backgroundColor: palette.primary },
              ]}
            />
          </View>
          <Text
            style={[
              styles.placeholderLabel,
              isHero && styles.placeholderLabelHero,
              { color: palette.textSecondary },
            ]}
          >
            {isHero ? "FOTOGRAFÍA PRÓXIMAMENTE" : "SIN FOTOGRAFÍA"}
          </Text>

          {isHero && (
            <Text
              style={[styles.placeholderHint, { color: palette.textSecondary }]}
            >
              Este destino aún no tiene imágenes publicadas en el catálogo
              patrimonial.
            </Text>
          )}
          <PlaceholderTocapu />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: palette.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  thumb: {
    width: "100%",
    height: 132,
  },
  hero: {
    width: "100%",
    height: 220,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  placeholderHero: {
    gap: 12,
    paddingHorizontal: 24,
  },
  diamondOuter: {
    width: 26,
    height: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
  },
  diamondOuterHero: {
    width: 40,
    height: 40,
  },
  diamondInner: {
    position: "absolute",
    width: 16,
    height: 16,
    borderWidth: 1,
    opacity: 0.7,
  },
  diamondInnerHero: {
    width: 24,
    height: 24,
  },
  diamondDot: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  diamondDotHero: {
    width: 8,
    height: 8,
  },
  placeholderLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  placeholderLabelHero: {
    fontSize: 11,
    letterSpacing: 2,
  },
  placeholderHint: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    maxWidth: 320,
  },
  tocapu: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 160,
    height: 6,
    marginTop: 2,
    gap: 2,
  },
  tocapuSeg: {
    flex: 1,
    height: 6,
    borderRadius: 1,
  },
});
