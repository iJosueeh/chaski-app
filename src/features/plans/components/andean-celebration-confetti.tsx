/**
 * Confeti ceremonial textil andino con react-native-reanimated (Serie AX).
 *
 * Características:
 * - Partículas geométricas discretas inspiradas en tocapus (rombos, cuadrados y cintas).
 * - Paleta Serie AX: dorado ocre (#D4AF37), terracota (#9C3E1B), borgoña (#7D2935) y marfil (#FFFDF9).
 * - No intrusivo: container con pointerEvents="none" que mantiene los botones 100% operativos.
 * - Accesibilidad: respeta AccessibilityInfo.isReduceMotionEnabled().
 * - Ejecución controlada one-shot: dura 2.8 segundos y se desmonta sin bucles.
 */
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ANDEAN_COLORS = ['#D4AF37', '#9C3E1B', '#7D2935', '#4A2E18', '#FFFDF9'];

interface ParticleConfig {
  id: number;
  startX: number;
  driftX: number;
  delay: number;
  size: number;
  color: string;
  shape: 'diamond' | 'square' | 'strip';
  rotationSpins: number;
}

function ParticleItem({
  config,
  progress,
}: {
  config: ParticleConfig;
  progress: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;

    const translateY = interpolate(
      p,
      [0, 1],
      [-20, SCREEN_HEIGHT * 0.75]
    );

    const translateX = interpolate(
      p,
      [0, 0.4, 0.8, 1],
      [config.startX, config.startX + config.driftX, config.startX - config.driftX * 0.5, config.startX + config.driftX * 0.8]
    );

    const rotate = `${p * config.rotationSpins * 360}deg`;

    const opacity = interpolate(
      p,
      [0, 0.1, 0.75, 1],
      [0, 1, 0.85, 0]
    );

    return {
      position: 'absolute',
      left: 0,
      top: 0,
      opacity,
      transform: [
        { translateX },
        { translateY },
        { rotate },
      ],
    };
  });

  const shapeStyle = useMemo(() => {
    switch (config.shape) {
      case 'diamond':
        return {
          width: config.size,
          height: config.size,
          backgroundColor: config.color,
          transform: [{ rotate: '45deg' }],
        };
      case 'strip':
        return {
          width: Math.max(config.size * 0.5, 3),
          height: config.size * 1.5,
          backgroundColor: config.color,
          borderRadius: 1,
        };
      case 'square':
      default:
        return {
          width: config.size,
          height: config.size,
          backgroundColor: config.color,
          borderRadius: 1,
        };
    }
  }, [config.shape, config.size, config.color]);

  return (
    <Animated.View style={animatedStyle}>
      <View style={shapeStyle} />
    </Animated.View>
  );
}

export interface AndeanCelebrationConfettiProps {
  active?: boolean;
}

export function AndeanCelebrationConfetti({ active = true }: AndeanCelebrationConfettiProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [finished, setFinished] = useState(false);
  const progress = useSharedValue(0);

  const shouldRender = active && !reduceMotion && !finished;

  // Generación determinista y equilibrada de 12 partículas discretas
  const particles = useMemo<ParticleConfig[]>(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const step = (i * 8.3) % 100;
      const startX = (step / 100) * (SCREEN_WIDTH - 24) + 12;
      const driftX = ((i % 4) - 1.5) * 14;
      const delay = (i % 4) * 80;
      const size = 5 + (i % 3) * 2;
      const color = ANDEAN_COLORS[i % ANDEAN_COLORS.length];
      const shape: ParticleConfig['shape'] =
        i % 3 === 0 ? 'diamond' : i % 3 === 1 ? 'square' : 'strip';
      const rotationSpins = (i % 2) + 1;

      return {
        id: i,
        startX,
        driftX,
        delay,
        size,
        color,
        shape,
        rotationSpins,
      };
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Verificar si el usuario tiene activada la preferencia de movimiento reducido
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setReduceMotion(enabled);
      })
      .catch(() => {
        // En caso de fallo de API, asumir valor estándar
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!active || reduceMotion || finished) {
      return;
    }

    // Iniciar animación con react-native-reanimated
    progress.value = withDelay(
      100,
      withTiming(1, {
        duration: 2600,
        easing: Easing.out(Easing.cubic),
      })
    );

    // Ocultar al finalizar la animación
    const timer = setTimeout(() => {
      setFinished(true);
    }, 2800);

    return () => clearTimeout(timer);
  }, [active, reduceMotion, finished, progress]);

  if (!shouldRender) {
    return null;
  }

  return (
    <View
      style={styles.overlay}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
    >
      {particles.map((p) => (
        <ParticleItem key={p.id} config={p} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 99,
  },
});
