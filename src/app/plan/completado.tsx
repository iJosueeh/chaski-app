/**
 * Plan Completado — Pantalla de celebración y validación de boleto (Serie AX).
 *
 * Flujo:
 * - Se muestra tras pulsar «Finalizar» en la pantalla de recorrido activo.
 * - Sello ceremonial con el Pututu andino anunciando la llegada exitosa.
 * - Celebración de confeti textil andino (react-native-reanimated) one-shot.
 * - Resumen del boleto con las paradas alcanzadas y sello cultural de tránsito.
 * - Acciones: primaria (exploraciones) y secundaria (volver al inicio) diferenciadas.
 * - Distribución vertical flexible: el bloque se centra y el scroll absorbe
 *   el excedente; los insets del sistema se respetan en ambos extremos.
 * - La duración proviene de `duracion_total_min` de la expedición, con respaldo
 *   en la suma de las paradas del boleto si el total no estuviera almacenado.
 */
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { formatDateShort } from '@/shared/utils/format-date';
import { AndeanTransitStamp } from '@/features/auth/components/andean-transit-stamp';
import { AndeanCelebrationConfetti } from '@/features/plans/components/andean-celebration-confetti';
import { PututuIllustration } from '@/features/plans/components/pututu-illustration';
import { usePlans } from '@/features/plans/context/plans-context';
import {
  markCelebrationAsTriggered,
  shouldTriggerCelebration,
} from '@/features/plans/utils/celebration-tracker';
import { resolveEstadoExpedicion } from '@/features/plans/utils/historial-formatters';
import {
  formatCompletadoTicketMeta,
  getCompletadoDurationMinutes,
  getCompletadoPresentation,
} from '@/features/plans/utils/plan-completado-formatters';
import { TocapuStrip, WizardButton } from '@/features/wizard/components/wizard-ui';

const palette = Colors.light;

export default function PlanCompletadoScreen() {
  const insets = useSafeAreaInsets();
  const { historial } = usePlans();
  const entry = historial[0]; // Plan recién archivado en la primera posición

  const paradasVisitadas = entry?.paradas_visitadas ?? [];
  const totalParadas = entry?.paradas?.length ?? 0;
  const visitadasCount = paradasVisitadas.length;
  const estado = resolveEstadoExpedicion(entry ?? {});

  const fechaFormateada = entry ? formatDateShort(entry.completado_en) : '';

  const presentation = getCompletadoPresentation(
    estado,
    entry?.titulo ?? 'Expedición',
    fechaFormateada,
    visitadasCount,
    totalParadas,
  );

  const [celebrate] = useState(() => {
    if (entry && presentation.puedeCelebrar && shouldTriggerCelebration(entry.id, entry.completado_en, Date.now(), estado)) {
      markCelebrationAsTriggered(entry.id, entry.completado_en);
      return true;
    }
    return false;
  });

  // Duración de la expedición: total del motor (permanencia + traslados),
  // con respaldo en la suma de paradas si el total no estuviera almacenado.
  const ticketMeta = entry
    ? formatCompletadoTicketMeta(totalParadas, getCompletadoDurationMinutes(entry))
    : '';

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      {/* Barra de estado con iconos y texto oscuros sobre fondo pergamino claro */}
      <StatusBar style="dark" />

      {/* Confeti ceremonial textil andino (pointerEvents="none") solo para completadas */}
      <AndeanCelebrationConfetti active={celebrate} />

      {/*
        Cenefa tocapu: elemento decorativo (accessible={false}), sin rol funcional.
        Se posiciona dentro del área segura superior para no invadir la barra
        de estado de Android ni competir con el sello ceremonial.
      */}
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.tocapuWrap,
          { paddingTop: insets.top, backgroundColor: palette.background },
        ]}
      >
        <TocapuStrip />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.body}>
          <View style={styles.topSection}>
            {/* Ilustración ceremonial del Pututu Serie AX */}
            <PututuIllustration width={124} />

            {/* Kicker y Título principal honesto */}
            <Text style={[styles.kicker, { color: palette.primary }]}>
              {presentation.kicker}
            </Text>
            <Text style={[styles.title, { color: palette.brand }]}>
              {presentation.titulo}
            </Text>

            {entry ? (
              <>
                <Text style={[styles.sub, { color: palette.textSecondary }]}>
                  {presentation.subtitulo}
                </Text>

                {/* Tarjeta de resumen de viaje tipo boleto sellado */}
                <View
                  style={[
                    styles.ticket,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  {/* Acento Serie AX en flujo normal (sin posiciones absolutas) */}
                  <View
                    style={[
                      styles.ticketAccent,
                      { backgroundColor: palette.accent },
                    ]}
                  />

                  <View style={styles.ticketInner}>
                    <View style={styles.ticketHeader}>
                      <Text style={[styles.ticketKicker, { color: palette.primary }]}>
                        {presentation.ticketKicker}
                      </Text>
                      <Text style={[styles.ticketMeta, { color: palette.textSecondary }]}>
                        {ticketMeta}
                      </Text>
                    </View>

                    {/* Lista de paradas distinguiendo honestamente visitadas vs pendientes */}
                    <View style={styles.paradasList}>
                      {entry.paradas.map((s) => {
                        const isLegacy = entry.paradas_visitadas === undefined;
                        const isVisited = paradasVisitadas.includes(s.orden);

                        return (
                          <View key={s.orden} style={styles.paradaRow}>
                            <View
                              style={[
                                styles.paradaDot,
                                {
                                  backgroundColor: isVisited
                                    ? palette.primary
                                    : isLegacy
                                    ? palette.accent
                                    : 'rgba(138, 124, 100, 0.2)',
                                },
                              ]}
                            />
                            <Text
                              style={[
                                styles.paradaNombre,
                                {
                                  color: isVisited || isLegacy
                                    ? palette.brand
                                    : palette.textSecondary,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {s.place.nombre}
                            </Text>
                            <Text
                              style={[styles.paradaHora, { color: palette.textSecondary }]}
                            >
                              {isVisited
                                ? `✓ ${s.llegada}`
                                : isLegacy
                                ? s.llegada
                                : 'PENDIENTE'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Sello de tránsito andino Serie AX */}
                    <View style={styles.stampDivider} />
                    <AndeanTransitStamp
                      compact={true}
                      folio={presentation.stampFolio}
                      station="LÍNEA CULTURAL CHASKI"
                      route={presentation.stampRoute}
                    />
                  </View>
                </View>
              </>
            ) : (
              <View
                style={[
                  styles.ticket,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text style={[styles.emptyHint, { color: palette.textSecondary }]}>
                  Tu recorrido ha sido sellado exitosamente. Consulta tus registros anteriores en el historial.
                </Text>
              </View>
            )}
          </View>

          {/* Acciones: primaria (relleno) y secundaria (contorno) diferenciadas */}
          <View style={styles.ctas}>
            <WizardButton
              label="VER MIS EXPLORACIONES"
              onPress={() => router.replace('/(tabs)/historial')}
            />
            <SecondaryAction
              label="VOLVER AL INICIO"
              onPress={() => router.replace('/(tabs)')}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Acción secundaria en contorno: misma métrica táctil y tipografía mono que
 * la primaria, pero sin relleno, para que la jerarquía visual sea inequívoca.
 */
function SecondaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.secondaryBtn,
        { backgroundColor: palette.surface, borderColor: palette.primary },
      ]}
    >
      <Text style={[styles.secondaryBtnText, { color: palette.primary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  tocapuWrap: {
    width: '100%',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    gap: 16,
  },
  topSection: {
    alignItems: 'stretch',
    gap: 10,
  },
  kicker: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    fontWeight: '700',
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 23,
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 28,
  },
  sub: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  ticket: {
    borderRadius: 6,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#4A2E18',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  ticketAccent: {
    height: 4,
    width: '100%',
  },
  ticketInner: {
    padding: 16,
    gap: 10,
  },
  ticketHeader: {
    gap: 2,
  },
  ticketKicker: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  ticketMeta: {
    fontFamily: Fonts.mono,
    fontSize: 10,
  },
  paradasList: {
    gap: 8,
  },
  paradaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  paradaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  paradaNombre: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  paradaHora: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
  },
  stampDivider: {
    height: 1,
    backgroundColor: 'rgba(226, 215, 195, 0.7)',
  },
  emptyHint: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    padding: 16,
  },
  ctas: {
    gap: 12,
  },
  secondaryBtn: {
    height: 50,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textAlign: 'center',
  },
});
