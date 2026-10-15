import { StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';

export interface AndeanTocapuDividerProps {
  style?: object;
}

/**
 * Separador decorativo con geometría andina discreta (Serie AX).
 * Inspirado en grecas textiles incaicas y motivos tocapu.
 * Implementado 100% con vistas nativas ligeras sin librerías pesadas.
 */
export function AndeanTocapuDivider({ style }: AndeanTocapuDividerProps) {
  return (
    <View style={[styles.container, style]} accessible={false} importantForAccessibility="no">
      <View style={styles.line} />
      <View style={styles.motif}>
        <View style={styles.diamondOuter} />
        <View style={styles.diamondInner} />
        <View style={styles.centerDot} />
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 10,
    width: '100%',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  motif: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondOuter: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: Colors.light.accent,
    transform: [{ rotate: '45deg' }],
  },
  diamondInner: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: 'rgba(156, 62, 27, 0.4)',
    transform: [{ rotate: '45deg' }],
  },
  centerDot: {
    width: 4,
    height: 4,
    backgroundColor: Colors.light.primary,
    borderRadius: 1,
  },
});
