/**
 * "Buscando planes..." — pantalla de carga con mensajes animados (Serie AX).
 * Al terminar: el hook de generación entrega los 3 planes y esta pantalla navega
 * a Resultados (respetando el mínimo visible de la animación).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/context/auth-context';
import { usePlanGeneration, type PlanGenerationErrorKind } from '@/features/plans/hooks';
import { useWizard } from '@/features/wizard/context/wizard-context';
import { TocapuStrip, WizardButton, WizardTopBar } from '@/features/wizard/components/wizard-ui';
import { safeBackWizard, safeCancelWizard } from '@/features/wizard/utils/wizard-navigation';

const palette = Colors.light;

/** Duración mínima visible de la animación de búsqueda (presentación). */
const MIN_BUSQUEDA_MS = 2200;

const MENSAJES = [
  'Consultando destinos patrimoniales cercanos…',
  'Optimizando secuencias y tiempos de traslado…',
  'Ajustando paradas a tu presupuesto y ritmo…',
  'Calculando alternativas de expedición Serie AX…',
  'Finalizando emisión de tus boletos de ruta…',
];

/** Copy de error por kind: la clasificación vive en el hook, el texto aquí. */
function resolveErrorMessage(
  kind: PlanGenerationErrorKind,
  detail: string | null,
): string {
  switch (kind) {
    case 'unauthenticated':
      return 'Se requiere una sesión activa para generar y registrar una expedición patrimonial.';
    case 'solicitud':
      return detail || 'No pudimos registrar tu solicitud de planificación en el servidor.';
    case 'catalog':
      return 'No pudimos conectar con el catálogo patrimonial. Verifica tu conexión.';
    case 'unexpected':
    default:
      return 'Ocurrió un error inesperado al calcular las rutas.';
  }
}

export default function BuscandoPlanes() {
  const { user } = useAuth();
  const { request, setSolicitudId } = useWizard();
  const [msgIdx, setMsgIdx] = useState(0);

  const { status, errorKind, errorDetail, result, retry } = usePlanGeneration({
    request,
    userId: user?.id,
    onSolicitudSaved: setSolicitudId,
  });

  // Rotación de mensajes de cortesía (presentación).
  useEffect(() => {
    const rot = setInterval(() => {
      setMsgIdx((i) => Math.min(i + 1, MENSAJES.length - 1));
    }, 850);
    return () => clearInterval(rot);
  }, []);

  // Navegación al terminar, garantizando el mínimo visible de la animación.
  useEffect(() => {
    if (status !== 'success' || !result) return;

    const wait = Math.max(0, MIN_BUSQUEDA_MS - result.elapsedMs);
    const timer = setTimeout(() => {
      router.replace({
        pathname: '/plan/resultados',
        params: {
          planes: JSON.stringify(result.planes),
          solicitudId: result.solicitudId,
        },
      });
    }, wait);

    return () => clearTimeout(timer);
  }, [status, result]);

  const errorMessage =
    status === 'error' && errorKind ? resolveErrorMessage(errorKind, errorDetail) : null;

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <WizardTopBar
        onBack={() => safeBackWizard('/wizard/movilidad')}
        onCancel={safeCancelWizard}
      />
      <TocapuStrip />
      {errorMessage ? (
        <View style={styles.errorCenter}>
          <Text style={styles.errorGlyph}>📜</Text>
          <Text style={[styles.errorTitle, { color: palette.brand }]}>
            No pudimos consultar el catálogo
          </Text>
          <Text style={[styles.errorText, { color: palette.textSecondary }]}>
            {errorMessage}
          </Text>
          <View style={styles.errorCtaWrap}>
            <WizardButton
              label="REINTENTAR BÚSQUEDA"
              onPress={retry}
            />
          </View>
        </View>
      ) : (
        <View style={styles.center}>
          {/* Sello de cálculo geométrico andino */}
          <View style={[styles.sello, { borderColor: palette.accent }]}>
            <View style={[styles.selloInner, { borderColor: palette.primary }]} />
            <View style={[styles.selloCenter, { backgroundColor: palette.primary }]} />
          </View>
          <Text style={[styles.msg, { color: palette.brand }]}>{MENSAJES[msgIdx]}</Text>
          <Text style={[styles.sub, { color: palette.textSecondary }]}>
            SERIE AX · MOTOR DE EXPEDICIÓN
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  sello: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selloInner: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    opacity: 0.7,
  },
  selloCenter: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  msg: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  sub: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },

  errorCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  errorGlyph: { fontSize: 40, textAlign: 'center' },
  errorTitle: {
    fontFamily: Fonts.serif,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  errorCtaWrap: {
    width: '100%',
    marginTop: 16,
  },
});
