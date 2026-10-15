/**
 * Componente visual para la ilustración ceremonial del PUTUTU (Serie AX).
 *
 * El Pututu (trompeta de caracola marina andina) es el instrumento tradicional
 * que los mensajeros chaskis hacían sonar para anunciar su llegada y victoria.
 *
 * Carga directamente la ilustración PNG transparente desde `assets/images/pututu.png`
 * preservando su transparencia natural, escala y relación de aspecto (1312x1199).
 */
import { Image, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

const palette = Colors.light;

const PUTUTU_IMAGE_SOURCE = require('@/assets/images/pututu.png');

// Proporción original del activo definitivo (1312 x 1199 px)
const PUTUTU_ASPECT_RATIO = 1312 / 1199;

interface PututuIllustrationProps {
  /** Ancho visual del pututu en dp (la altura se calcula automáticamente) */
  width?: number;
}

export function PututuIllustration({ width = 124 }: PututuIllustrationProps) {
  const height = Math.round(width / PUTUTU_ASPECT_RATIO);

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel="Pututu ceremonial andino, anuncio tradicional de victoria y llegada del Chaski"
    >
      {/* Ilustración PNG transparente integrada de forma natural */}
      <View style={[styles.imageContainer, { width, height }]}>
        <Image
          source={PUTUTU_IMAGE_SOURCE}
          style={[styles.image, { width, height }]}
          resizeMode="contain"
        />
      </View>

      <Text style={[styles.caption, { color: palette.primary }]}>
        EL TOQUE DEL PUTUTU
      </Text>
      <Text style={[styles.subcaption, { color: palette.textSecondary }]}>
        Anuncio ceremonial de expedición cumplida
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    // Preserva la transparencia nativa del archivo PNG sin recortes
  },
  caption: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 8,
    textAlign: 'center',
  },
  subcaption: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
});
