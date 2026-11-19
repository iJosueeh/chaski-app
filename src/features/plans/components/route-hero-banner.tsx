/**
 * Hero Banner de la Ruta (Serie AX)
 * Archivo: src/features/plans/components/route-hero-banner.tsx
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts } from '@/constants/theme';

const palette = Colors.light;

interface RouteHeroBannerProps {
  imageUrl?: string | null;
  title: string;
  badge?: string;
}

function FallbackTocapu() {
  return (
    <View style={styles.fallbackContainer} accessible={false}>
      <View style={styles.tocapuGrid}>
        {Array.from({ length: 9 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.tocapuCell,
              {
                backgroundColor:
                  index % 3 === 0
                    ? palette.accent
                    : index % 3 === 1
                    ? palette.backgroundSelected
                    : 'rgba(156, 62, 27, 0.25)',
              },
            ]}
          />
        ))}
      </View>
      <Ionicons name="map-outline" size={32} color={palette.textSecondary} />
      <Text style={styles.fallbackText}>EXPEDICIÓN PATRIMONIAL</Text>
    </View>
  );
}

export function RouteHeroBanner({
  imageUrl,
  title,
  badge = 'EXPEDICIÓN PATRIMONIAL',
}: RouteHeroBannerProps) {
  const [loadError, setLoadError] = useState(false);
  const hasValidImage = Boolean(imageUrl) && !loadError;

  return (
    <View style={styles.bannerWrapper}>
      {hasValidImage ? (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl! }}
            style={styles.image}
            contentFit="cover"
            transition={300}
            onError={() => setLoadError(true)}
            accessibilityLabel={`Portada de la ruta ${title}`}
          />
          <View style={styles.overlayVignette}>
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          </View>
        </View>
      ) : (
        <FallbackTocapu />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: palette.backgroundElement,
    borderWidth: 1.5,
    borderColor: palette.border,
    marginTop: 8,
    marginBottom: 16,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlayVignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(74, 46, 24, 0.25)',
    justifyContent: 'space-between',
    padding: 12,
  },
  badgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74, 46, 24, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  badgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: palette.accent,
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  tocapuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 60,
    height: 60,
    gap: 3,
    marginBottom: 4,
  },
  tocapuCell: {
    width: 17,
    height: 17,
    borderRadius: 2,
  },
  fallbackText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: palette.textSecondary,
    fontWeight: '600',
  },
});
