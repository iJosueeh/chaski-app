import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

export interface AndeanTransitStampProps {
  folio?: string;
  station?: string;
  route?: string;
  compact?: boolean;
}

/**
 * Sello cultural andino estilizado de control y expedición (Serie AX).
 * Representa una estampilla / sello de control de pasaje con motivos geométricos
 * inspirados en tocapus y arquitectura andina (cruz escalonada / chakana).
 *
 * Características:
 * - Puramente decorativo: marcado con accessible={false} e importantForAccessibility="no".
 * - Tipografía y paleta Serie AX (Dorado ocre, Terracota, Taupe, Marrón tinta).
 * - Diseño vectorial minimalista con vistas nativas sin dependencias pesadas.
 * - Modo compact para integración discreta al pie de pantallas sin sobrecargar.
 */
export function AndeanTransitStamp({
  folio = 'VALIDEZ SERIE AX · N° 00001',
  station = 'ESTACIÓN CENTRAL CHASKI',
  route = 'CONTROL DE EMBARQUE · LÍNEA CULTURAL',
  compact = false,
}: AndeanTransitStampProps) {
  return (
    <View style={styles.stampOuter} accessible={false} importantForAccessibility="no">
      <View style={[styles.stampInner, compact && styles.stampInnerCompact]}>
        {/* Cabecera del sello */}
        <Text style={[styles.stationText, compact && styles.stationTextCompact]}>{station}</Text>

        {/* Separador con motivo central geométrico andino */}
        <View style={[styles.motifRow, compact && styles.motifRowCompact]}>
          <View style={styles.motifLine} />
          <View style={[styles.chacanaBadge, compact && styles.chacanaBadgeCompact]}>
            <View style={[styles.chacanaDiamondGold, compact && styles.chacanaDiamondGoldCompact]} />
            <View style={[styles.chacanaStepCross, compact && styles.chacanaStepCrossCompact]} />
            <View style={[styles.chacanaCenterDot, compact && styles.chacanaCenterDotCompact]} />
          </View>
          <View style={styles.motifLine} />
        </View>

        {/* Leyenda central y folio de control */}
        <Text style={[styles.routeText, compact && styles.routeTextCompact]}>{route}</Text>
        <Text style={[styles.folioText, compact && styles.folioTextCompact]}>{folio}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stampOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  stampInner: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'rgba(240, 232, 216, 0.35)', // Arena pergamino translúcido
    maxWidth: 320,
    gap: 4,
  },
  stationText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  motifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 2,
  },
  motifLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.accent,
    opacity: 0.5,
  },
  chacanaBadge: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chacanaStepCross: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: Colors.light.accent,
    backgroundColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  chacanaDiamondGold: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)', // Dorado suave
    backgroundColor: 'transparent',
  },
  chacanaCenterDot: {
    width: 6,
    height: 6,
    backgroundColor: Colors.light.primary, // Terracota
    borderRadius: 1,
  },
  routeText: {
    fontFamily: Fonts.serif,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: Colors.light.brand,
    textAlign: 'center',
  },
  folioText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: Colors.light.accent,
    fontWeight: '600',
    textAlign: 'center',
  },
  /* Variantes compactas */
  stampInnerCompact: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    maxWidth: 260,
    gap: 2,
    borderRadius: 8,
  },
  stationTextCompact: {
    fontSize: 7.5,
    letterSpacing: 1.2,
  },
  motifRowCompact: {
    paddingVertical: 1,
    gap: 6,
  },
  chacanaBadgeCompact: {
    width: 16,
    height: 16,
  },
  chacanaStepCrossCompact: {
    width: 10,
    height: 10,
  },
  chacanaDiamondGoldCompact: {
    width: 13,
    height: 13,
  },
  chacanaCenterDotCompact: {
    width: 4,
    height: 4,
  },
  routeTextCompact: {
    fontSize: 9,
    letterSpacing: 1,
  },
  folioTextCompact: {
    fontSize: 7.5,
    letterSpacing: 0.8,
  },
});
