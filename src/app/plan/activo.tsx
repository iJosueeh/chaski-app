/**
 * Plan Activo — El recorrido en curso (Serie AX).
 *
 * Flujo:
 * - Lista de paradas ordenadas con metadatos reales y precisos.
 * - Marcado accesible de paradas visitadas con controles táctiles de >= 48x48 dp.
 * - Acción real de «Cómo llegar» que abre mapas nativos con las coordenadas del lugar.
 * - Mensaje explícito del estado del botón «Finalizar».
 * - Paleta Serie AX clara: pergamino (#FAF5EE), marfil (#FFFDF9), tinta (#4A2E18),
 *   terracota (#9C3E1B), borgoña (#7D2935) y dorado ocre (#D4AF37).
 */
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { TocapuStrip, WizardButton, WizardTopBar } from '@/features/wizard/components/wizard-ui';
import { usePlans } from '@/features/plans/context/plans-context';
import {
  buildMapsNavigationUrl,
  formatStopArrivalLabel,
  formatStopCostLabel,
  formatStopDurationLabel,
  getFinalizarHelperText,
} from '@/features/plans/utils/plan-active-formatters';

const palette = Colors.light;

export default function PlanActivoScreen() {
  const insets = useSafeAreaInsets();
  const {
    planActivo,
    visitadas,
    marcarParada,
    paradaVisitada,
    completarPlan,
    abandonarPlan,
  } = usePlans();

  if (!planActivo) {
    return (
      <View style={[styles.canvas, { backgroundColor: palette.background }]}>
        <WizardTopBar
          onBack={() => router.replace('/(tabs)')}
          onCancel={() => router.replace('/(tabs)')}
        />
        <TocapuStrip />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyGlyph}>🎫</Text>
          <Text style={[styles.emptyTitle, { color: palette.brand }]}>
            No hay expedición activa
          </Text>
          <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
            No tienes un recorrido en curso en este momento. Traza una nueva ruta desde el inicio.
          </Text>
          <View style={styles.emptyCtaWrap}>
            <WizardButton
              label="TRAZAR MI RUTA"
              onPress={() => router.replace('/wizard/ubicacion')}
            />
          </View>
        </View>
      </View>
    );
  }

  const total = planActivo.paradas.length;
  const pct = total > 0 ? Math.round((visitadas.length / total) * 100) : 0;

  const finalizar = async () => {
    await completarPlan();
    router.replace('/plan/completado');
  };

  const cerrarVista = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const confirmarAbandono = () => {
    Alert.alert(
      '¿Abandonar expedición?',
      'El recorrido quedará archivado como abandonado en tu historial y volverás al inicio.',
      [
        { text: 'Continuar recorrido', style: 'cancel' },
        {
          text: 'Abandonar',
          style: 'destructive',
          onPress: async () => {
            await abandonarPlan();
            router.replace('/(tabs)');
          },
        },
      ],
    );
  };

  /** Abre la aplicación de mapas del dispositivo con las coordenadas reales del lugar */
  const abrirNavegacion = async (lat: number, lng: number, nombre: string) => {
    const { nativeUrl, webFallbackUrl } = buildMapsNavigationUrl(lat, lng, nombre, Platform.OS);
    try {
      const canOpen = await Linking.canOpenURL(nativeUrl);
      if (canOpen) {
        await Linking.openURL(nativeUrl);
      } else {
        await Linking.openURL(webFallbackUrl);
      }
    } catch {
      await Linking.openURL(webFallbackUrl);
    }
  };

  const finalizarHelperText = getFinalizarHelperText(visitadas.length, total);

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <WizardTopBar
        onBack={cerrarVista}
        onCancel={cerrarVista}
      />
      <TocapuStrip />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera del boleto de recorrido */}
        <View style={styles.header}>
          <View style={styles.kickerRow}>
            <Text style={[styles.kicker, { color: palette.primary }]}>
              EXPEDICIÓN EN CURSO · SERIE AX
            </Text>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(212, 175, 55, 0.18)' }]}>
              <Text style={[styles.badgeText, { color: palette.brand }]}>
                {total === 1 ? '1 PARADA' : `${total} PARADAS`}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { color: palette.brand }]}>
            {planActivo.titulo}
          </Text>

          {/* Barra de progreso Serie AX */}
          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <Text style={[styles.progressLabel, { color: palette.brand }]}>
                {visitadas.length === total
                  ? 'Recorrido completo'
                  : `Progreso: ${visitadas.length} de ${total} parada(s) visitada(s)`}
              </Text>
              <Text style={[styles.progressPct, { color: palette.burgundy }]}>
                {pct}%
              </Text>
            </View>
            <View
              style={[
                styles.progressTrack,
                { borderColor: palette.border, backgroundColor: palette.backgroundElement },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: palette.burgundy, width: `${pct}%` },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Explicación si el plan contiene una sola parada */}
        {total === 1 ? (
          <View style={[styles.singleStopNotice, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.singleStopNoticeTitle, { color: palette.primary }]}>
              ℹ️ ITINERARIO CONCENTRADO
            </Text>
            <Text style={[styles.singleStopNoticeText, { color: palette.textSecondary }]}>
              Esta ruta cuenta con una sola parada optimizada para ajustarse estrictamente a tu tiempo disponible, presupuesto o a los horarios de apertura de la zona.
            </Text>
          </View>
        ) : null}

        {/* Lista de paradas del recorrido */}
        <View style={styles.stopsSection}>
          <Text style={[styles.sectionTitle, { color: palette.brand }]}>
            ITINERARIO DE VISITAS
          </Text>

          {planActivo.paradas.map((s) => {
            const done = paradaVisitada(s.orden);
            const arrivalLabel = formatStopArrivalLabel(s.llegada);
            const durationLabel = formatStopDurationLabel(s.duracion_min);
            const costLabel = formatStopCostLabel(
              s.costo_estimado,
              s.place.gasto_min,
              s.place.gasto_max,
            );
            const hasCoords = Boolean(s.place.latitud && s.place.longitud);

            return (
              <View
                key={s.orden}
                style={[
                  styles.stopCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: done ? palette.accent : palette.border,
                  },
                ]}
              >
                {/* Cabecera de la parada */}
                <View style={styles.stopCardHeader}>
                  <View style={styles.stopBadge}>
                    <Text style={[styles.stopBadgeText, { color: palette.primary }]}>
                      ESTACIÓN {s.orden.toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.stopStatusBadge,
                      {
                        backgroundColor: done
                          ? 'rgba(122, 158, 109, 0.16)'
                          : 'rgba(138, 124, 100, 0.12)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stopStatusText,
                        { color: done ? palette.brand : palette.textSecondary },
                      ]}
                    >
                      {done ? '✓ VISITADA' : 'PENDIENTE'}
                    </Text>
                  </View>
                </View>

                {/* Nombre y dirección del lugar */}
                <Text
                  style={[
                    styles.stopNombre,
                    { color: palette.brand },
                    done && styles.stopNombreDone,
                  ]}
                >
                  {s.place.nombre}
                </Text>

                {s.place.direccion ? (
                  <Text style={[styles.stopDireccion, { color: palette.textSecondary }]} numberOfLines={2}>
                    📍 {s.place.direccion}
                  </Text>
                ) : null}

                {/* Metadatos precisos */}
                <View style={styles.metadataGrid}>
                  <View style={styles.metadataItem}>
                    <Text style={[styles.metadataLabel, { color: palette.textSecondary }]}>
                      HORARIO
                    </Text>
                    <Text style={[styles.metadataValue, { color: palette.brand }]}>
                      {arrivalLabel}
                    </Text>
                  </View>

                  <View style={styles.metadataItem}>
                    <Text style={[styles.metadataLabel, { color: palette.textSecondary }]}>
                      DURACIÓN
                    </Text>
                    <Text style={[styles.metadataValue, { color: palette.brand }]}>
                      {durationLabel}
                    </Text>
                  </View>

                  <View style={styles.metadataItem}>
                    <Text style={[styles.metadataLabel, { color: palette.textSecondary }]}>
                      COSTO
                    </Text>
                    <Text style={[styles.metadataValue, { color: palette.brand }]}>
                      {costLabel}
                    </Text>
                  </View>
                </View>

                {/* Fila de acciones accesibles (Mínimo 48x48 dp) */}
                <View style={styles.stopActionsRow}>
                  {/* Botón táctil para marcar parada visitada */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => marcarParada(s.orden)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={
                      done
                        ? `Parada ${s.orden}: ${s.place.nombre}, visitada. Toca para desmarcar.`
                        : `Parada ${s.orden}: ${s.place.nombre}, pendiente. Toca para marcar como visitada.`
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.checkButton,
                      {
                        backgroundColor: done
                          ? 'rgba(156, 62, 27, 0.08)'
                          : palette.backgroundElement,
                        borderColor: done ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.checkSquare,
                        {
                          backgroundColor: done ? palette.primary : palette.surface,
                          borderColor: done ? palette.primary : palette.border,
                        },
                      ]}
                    >
                      {done ? (
                        <Text style={[styles.checkSquareGlyph, { color: palette.surface }]}>
                          ✓
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.checkButtonText,
                        { color: done ? palette.primary : palette.brand },
                      ]}
                    >
                      {done ? 'DESMARCAR' : 'MARCAR VISITADA'}
                    </Text>
                  </TouchableOpacity>

                  {/* Botón «Cómo llegar» usando coordenadas reales */}
                  {hasCoords ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() =>
                        abrirNavegacion(s.place.latitud, s.place.longitud, s.place.nombre)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir indicaciones hacia ${s.place.nombre} en tu aplicación de mapas`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[
                        styles.routeButton,
                        {
                          backgroundColor: palette.surface,
                          borderColor: palette.accent,
                        },
                      ]}
                    >
                      <Text style={[styles.routeButtonText, { color: palette.brand }]}>
                        🗺 CÓMO LLEGAR ↗
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Panel de finalización y abandono */}
        <View style={styles.ctaWrap}>
          {/* Explicación de estado del botón Finalizar */}
          <View
            style={[
              styles.helperBox,
              {
                backgroundColor:
                  visitadas.length === 0
                    ? 'rgba(125, 41, 53, 0.06)'
                    : 'rgba(212, 175, 55, 0.12)',
                borderColor: palette.border,
              },
            ]}
          >
            <Text
              style={[
                styles.helperBoxText,
                {
                  color: visitadas.length === 0 ? palette.burgundy : palette.brand,
                },
              ]}
            >
              {finalizarHelperText}
            </Text>
          </View>

          <WizardButton
            label={
              visitadas.length === total
                ? 'FINALIZAR Y SELLAR EXPEDICIÓN'
                : `FINALIZAR (${visitadas.length}/${total})`
            }
            onPress={finalizar}
            disabled={visitadas.length === 0}
          />

          <Text style={[styles.navHint, { color: palette.textSecondary }]}>
            Puedes volver al Inicio con ✕ arriba en cualquier momento; tu recorrido y avance permanecen guardados.
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Abandonar expedición y descartar progreso"
            activeOpacity={0.7}
            onPress={confirmarAbandono}
            style={styles.abandonButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.abandonText, { color: palette.burgundy }]}>
              ABANDONAR EXPEDICIÓN
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scroll: {
    paddingTop: 8,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  kickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kicker: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    marginTop: 2,
  },
  progressSection: {
    marginTop: 14,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  progressPct: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  singleStopNotice: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 6,
    gap: 4,
  },
  singleStopNoticeTitle: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  singleStopNoticeText: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    lineHeight: 16,
  },
  stopsSection: {
    paddingHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  stopCard: {
    borderWidth: 1.5,
    borderRadius: 6,
    padding: 14,
    gap: 8,
  },
  stopCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopBadge: {
    backgroundColor: 'rgba(156, 62, 27, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  stopBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  stopStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  stopStatusText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stopNombre: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  stopNombreDone: {
    opacity: 0.65,
    textDecorationLine: 'line-through',
  },
  stopDireccion: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    lineHeight: 15,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 215, 195, 0.6)',
  },
  metadataItem: {
    minWidth: '45%',
    flex: 1,
  },
  metadataLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metadataValue: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    marginTop: 1,
  },
  stopActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 215, 195, 0.6)',
  },
  checkButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.2,
    borderRadius: 6,
    paddingHorizontal: 12,
  },
  checkSquare: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSquareGlyph: {
    fontSize: 13,
    fontWeight: '700',
  },
  checkButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  routeButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderRadius: 6,
    paddingHorizontal: 12,
  },
  routeButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ctaWrap: {
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  helperBox: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 6,
  },
  helperBoxText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  navHint: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 8,
  },
  abandonButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 12,
  },
  abandonText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
  },
  emptyGlyph: {
    fontSize: 36,
  },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '700',
  },
  emptyText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyCtaWrap: {
    width: '100%',
    marginTop: 16,
  },
});
