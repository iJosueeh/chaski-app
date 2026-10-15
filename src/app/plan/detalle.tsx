/**
 * "Detalle del plan" — info completa del plan elegido (Serie AX):
 * itinerario parada por parada, costos, duración y justificación.
 * "Elegir este plan" lo activa y regresa de forma segura al inicio.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { AndeanTransitStamp } from '@/features/auth/components/andean-transit-stamp';
import { TocapuStrip, WizardButton, WizardTopBar } from '@/features/wizard/components/wizard-ui';
import { usePlans, type PlanHistorialEntry } from '@/features/plans/context/plans-context';
import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';
import type { SolicitudHistorialEntry } from '@/features/plans/interfaces/solicitudes-plan.interface';
import {
  formatHistoryDate,
  formatMovilidadSolicitud,
  formatPresupuestoSolicitud,
  formatSolicitudDuracion,
  formatSolicitudHorario,
  formatSolicitudTitulo,
  formatTipoPuntoFinal,
  formatTotalDuration,
  resolveEstadoExpedicion,
} from '@/features/plans/utils/historial-formatters';
import { safeBackWizard, safeCancelWizard } from '@/features/wizard/utils/wizard-navigation';

const palette = Colors.light;

export default function DetallePlan() {
  const insets = useSafeAreaInsets();
  const { activarPlan, historial } = usePlans();
  const { plan: planJson, modo, entryId, solicitud: solicitudJson } = useLocalSearchParams<{
    plan?: string;
    modo?: string;
    entryId?: string;
    solicitud?: string;
  }>();

  const isHistorial = modo === 'historial';

  if (modo === 'solicitud') {
    return <SolicitudDetailView solicitudJson={solicitudJson} />;
  }

  let plan: (GeneratedPlan & Partial<PlanHistorialEntry>) | null = null;
  try {
    if (entryId && historial.length > 0) {
      plan = historial.find((h) => h.id === entryId) ?? null;
    }
    if (!plan && planJson) {
      plan = JSON.parse(planJson);
    }
  } catch {
    plan = null;
  }

  const goBack = () => {
    if (isHistorial) {
      router.replace('/(tabs)/historial');
    } else {
      safeBackWizard('/plan/resultados');
    }
  };

  const cancelAction = () => {
    if (isHistorial) {
      router.replace('/(tabs)/historial');
    } else {
      safeCancelWizard();
    }
  };

  if (!plan) {
    return (
      <View style={[styles.canvas, { backgroundColor: palette.background }]}>
        <WizardTopBar
          onBack={goBack}
          onCancel={cancelAction}
        />
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
            Plan no encontrado.
          </Text>
          <WizardButton
            label={isHistorial ? 'VOLVER AL HISTORIAL' : 'VOLVER A RESULTADOS'}
            onPress={goBack}
          />
        </View>
      </View>
    );
  }

  const estado = resolveEstadoExpedicion(plan);
  const paradasVisitadas = plan.paradas_visitadas ?? [];
  const isLegacy = plan.paradas_visitadas === undefined;
  const fechaCompletado = plan.completado_en ? formatHistoryDate(plan.completado_en) : null;

  const statusBadgeText = isHistorial
    ? estado === 'COMPLETADA'
      ? 'SERIE AX · EXPEDICIÓN COMPLETADA'
      : estado === 'PARCIAL'
      ? `SERIE AX · EXPEDICIÓN PARCIAL (${paradasVisitadas.length}/${plan.paradas.length})`
      : estado === 'ABANDONADA'
      ? 'SERIE AX · EXPEDICIÓN ABANDONADA'
      : 'SERIE AX · ARCHIVO HISTÓRICO'
    : plan.titulo.toUpperCase();

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <WizardTopBar
        onBack={goBack}
        onCancel={cancelAction}
      />
      <TocapuStrip />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.primary }]}>{statusBadgeText}</Text>
          <Text style={[styles.title, { color: palette.brand }]}>{plan.titulo}</Text>
          {!!plan.descripcion && (
            <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{plan.descripcion}</Text>
          )}
          {isHistorial && !!fechaCompletado && (
            <View style={[styles.historyMetaPill, { backgroundColor: palette.backgroundElement, borderColor: palette.border }]}>
              <Text style={[styles.historyMetaPillText, { color: palette.burgundy }]}>
                {estado === 'ABANDONADA' ? 'Interrumpida el: ' : 'Sellado el: '}
                {fechaCompletado}
              </Text>
            </View>
          )}
        </View>

        {/* Resumen de viaje */}
        <View style={[styles.summary, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>DURACIÓN</Text>
            <Text style={[styles.summaryVal, { color: palette.brand }]}>
              {Math.floor(plan.duracion_total_min / 60)}h {plan.duracion_total_min % 60}m
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>COSTO ESTIMADO</Text>
            <Text style={[styles.summaryVal, { color: palette.burgundy }]}>S/ {plan.costo_total}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>DISTANCIA</Text>
            <Text style={[styles.summaryVal, { color: palette.brand }]}>≈ {plan.distancia_km_aprox} km</Text>
          </View>
        </View>

        {/* Itinerario parada por parada */}
        <Text style={[styles.sectionTitle, { color: palette.brand }]}>
          {isHistorial ? 'ITINERARIO Y ESTADO DE ESTACIONES' : 'ITINERARIO DE ESTACIONES'}
        </Text>
        <View style={styles.stopsList}>
          {plan.paradas.map((s) => {
            const isVisited = isHistorial && !isLegacy && paradasVisitadas.includes(s.orden);
            const isOmitted = isHistorial && !isLegacy && !paradasVisitadas.includes(s.orden);

            return (
              <View
                key={s.place?.id ?? `stop-${s.orden}`}
                style={[
                  styles.stop,
                  {
                    backgroundColor: palette.surface,
                    borderColor: isVisited
                      ? palette.accent
                      : isOmitted
                      ? palette.border
                      : palette.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.stopNum,
                    {
                      backgroundColor: isVisited
                        ? palette.primary
                        : isOmitted
                        ? palette.backgroundElement
                        : palette.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stopNumText,
                      {
                        color: isVisited
                          ? palette.surface
                          : isOmitted
                          ? palette.textSecondary
                          : palette.brand,
                      },
                    ]}
                  >
                    {isVisited ? '✓' : s.orden}
                  </Text>
                </View>
                <View style={styles.stopInfo}>
                  <View style={styles.stopHeaderRow}>
                    <Text style={[styles.stopHora, { color: palette.primary }]}>
                      {s.llegada} · {s.duracion_min} min
                    </Text>
                    {isHistorial && !isLegacy && (
                      <View
                        style={[
                          styles.stopBadgePill,
                          {
                            backgroundColor: isVisited
                              ? 'rgba(122, 158, 109, 0.16)'
                              : 'rgba(125, 41, 53, 0.08)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.stopBadgePillText,
                            { color: isVisited ? palette.brand : palette.burgundy },
                          ]}
                        >
                          {isVisited ? '✓ VISITADA' : 'NO VISITADA'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.stopNombre, { color: palette.brand }]}>{s.place?.nombre}</Text>
                  {!!s.place?.direccion && (
                    <Text style={[styles.stopDir, { color: palette.textSecondary }]} numberOfLines={1}>
                      {s.place.direccion}
                    </Text>
                  )}
                  <Text style={[styles.stopCosto, { color: palette.textSecondary }]}>
                    {s.costo_estimado === 0 ? 'Gratis' : `Entrada hasta S/ ${s.costo_estimado}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Sello de tránsito andino si es histórico */}
        {isHistorial && (
          <View style={styles.stampWrap}>
            <AndeanTransitStamp
              compact={true}
              folio={
                estado === 'COMPLETADA'
                  ? 'EXPEDICIÓN COMPLETA · SELLADA'
                  : estado === 'PARCIAL'
                  ? 'EXPEDICIÓN PARCIAL · ARCHIVADA'
                  : estado === 'ABANDONADA'
                  ? 'EXPEDICIÓN INTERRUMPIDA'
                  : 'REGISTRO HISTÓRICO'
              }
              station="ARCHIVO PATRIMONIAL CHASKI"
              route={plan.titulo.toUpperCase()}
            />
          </View>
        )}

        {/* Por qué este plan (solo en wizard de creación) */}
        {!isHistorial && (
          <>
            <Text style={[styles.sectionTitle, { color: palette.brand }]}>¿POR QUÉ ESTA RUTA?</Text>
            <View style={[styles.whyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.why, { color: palette.textSecondary }]}>
                {plan.variante === 'intimo'
                  ? `Ruta íntima diseñada para un ritmo pausado de ${plan.paradas.length} ${plan.paradas.length === 1 ? 'parada' : 'paradas'} cercanas (≈${plan.distancia_km_aprox} km), optimizando tus tiempos con un gasto estimado de S/ ${plan.costo_total}.`
                  : plan.variante === 'equilibrado'
                  ? `Plan equilibrado con ${plan.paradas.length} ${plan.paradas.length === 1 ? 'parada' : 'paradas'} que balancea variedad patrimonial, ritmo de visita y un costo controlado de S/ ${plan.costo_total}.`
                  : `Ruta exploradora con ${plan.paradas.length} ${plan.paradas.length === 1 ? 'parada' : 'paradas'} para una inmersión cultural amplia dentro de tu jornada y presupuesto de S/ ${plan.costo_total}.`}
              </Text>
            </View>
          </>
        )}

        <View style={styles.ctaWrap}>
          {isHistorial ? (
            <WizardButton
              label="VOLVER A MIS EXPLORACIONES"
              onPress={() => router.replace('/(tabs)/historial')}
            />
          ) : (
            <WizardButton
              label="ELEGIR ESTE PLAN"
              onPress={async () => {
                await activarPlan(plan as GeneratedPlan);
                router.replace('/(tabs)');
              }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SolicitudDetailView({ solicitudJson }: { solicitudJson?: string }) {
  const insets = useSafeAreaInsets();

  let solicitud: SolicitudHistorialEntry | null = null;
  try {
    solicitud = solicitudJson ? JSON.parse(solicitudJson) : null;
  } catch {
    solicitud = null;
  }

  const volverAlHistorial = () => router.replace('/(tabs)/historial');

  if (!solicitud) {
    return (
      <View style={[styles.canvas, { backgroundColor: palette.background }]}>
        <WizardTopBar
          onBack={volverAlHistorial}
          onCancel={volverAlHistorial}
        />
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
            Solicitud no encontrada.
          </Text>
          <WizardButton
            label="VOLVER AL HISTORIAL"
            onPress={volverAlHistorial}
          />
        </View>
      </View>
    );
  }

  const titulo = formatSolicitudTitulo(solicitud.inicio_descripcion);
  const horario = formatSolicitudHorario(solicitud.fecha_hora_inicio, solicitud.fecha_hora_fin);
  const expedicion = solicitud.expedicion ?? null;
  const snapshot = expedicion?.plan_snapshot ?? null;
  const estado = expedicion?.estado_expedicion ?? null;
  const visitadasList = expedicion?.paradas_visitadas ?? [];
  const paradasSnapshot = snapshot?.paradas ?? [];
  const duracion = snapshot
    ? formatTotalDuration(snapshot.duracion_total_min)
    : formatSolicitudDuracion(solicitud.fecha_hora_inicio, solicitud.fecha_hora_fin);
  const presupuesto = formatPresupuestoSolicitud(solicitud.gasto_min, solicitud.gasto_max);
  const movilidad = formatMovilidadSolicitud(solicitud.movilidad);
  const puntoFinal = formatTipoPuntoFinal(solicitud.tipo_punto_final, solicitud.final_descripcion);
  const partida = solicitud.inicio_descripcion ?? 'Ubicación seleccionada';
  const categorias = solicitud.categorias ?? [];

  const completadoIso = expedicion?.completado_en ?? null;
  const fechaSellado =
    completadoIso && !Number.isNaN(new Date(completadoIso).getTime())
      ? formatHistoryDate(completadoIso)
      : null;

  const kickerText =
    estado === 'COMPLETADA'
      ? 'SERIE AX · EXPEDICIÓN COMPLETADA'
      : estado === 'PARCIAL'
      ? `SERIE AX · EXPEDICIÓN PARCIAL (${visitadasList.length}/${paradasSnapshot.length})`
      : estado === 'ABANDONADA'
      ? 'SERIE AX · EXPEDICIÓN ABANDONADA'
      : 'SERIE AX · SOLICITUD DE RUTA';

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <WizardTopBar
        onBack={volverAlHistorial}
        onCancel={volverAlHistorial}
      />
      <TocapuStrip />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.primary }]}>{kickerText}</Text>
          <Text style={[styles.title, { color: palette.brand }]}>{titulo}</Text>
          <View style={[styles.historyMetaPill, { backgroundColor: palette.backgroundElement, borderColor: palette.border }]}>
            <Text style={[styles.historyMetaPillText, { color: palette.burgundy }]}>
              {expedicion ? (
                <>
                  {estado === 'ABANDONADA' ? 'Interrumpida' : 'Sellada'}
                  {fechaSellado ? ` el: ${fechaSellado}` : ''}
                </>
              ) : (
                <>Solicitada el: {formatHistoryDate(solicitud.fecha_creacion)}</>
              )}
            </Text>
          </View>
        </View>

        <View style={[styles.summary, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>HORARIO</Text>
            <Text style={[styles.summaryVal, { color: palette.brand }]}>{horario}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>DURACIÓN</Text>
            <Text style={[styles.summaryVal, { color: palette.brand }]}>{duracion}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>PRESUPUESTO</Text>
            <Text style={[styles.summaryVal, { color: palette.burgundy }]}>{presupuesto}</Text>
          </View>
          {snapshot && snapshot.costo_total != null && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>COSTO ESTIMADO</Text>
              <Text style={[styles.summaryVal, { color: palette.burgundy }]}>S/ {snapshot.costo_total}</Text>
            </View>
          )}
          {snapshot && snapshot.distancia_km_aprox != null && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>DISTANCIA</Text>
              <Text style={[styles.summaryVal, { color: palette.brand }]}>≈ {snapshot.distancia_km_aprox} km</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>MOVILIDAD</Text>
            <Text style={[styles.summaryVal, { color: palette.brand }]}>{movilidad}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>PARTIDA</Text>
            <Text
              style={[styles.summaryVal, { color: palette.brand, flexShrink: 1, textAlign: 'right' }]}
              numberOfLines={2}
            >
              {partida}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>PUNTO FINAL</Text>
            <Text
              style={[styles.summaryVal, { color: palette.brand, flexShrink: 1, textAlign: 'right' }]}
              numberOfLines={2}
            >
              {puntoFinal}
            </Text>
          </View>
        </View>

        {paradasSnapshot.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: palette.brand }]}>
              ITINERARIO Y ESTADO DE ESTACIONES
            </Text>
            <View style={styles.stopsList}>
              {paradasSnapshot.map((s) => {
                const isVisited = visitadasList.includes(s.orden);
                const isOmitted = !isVisited;

                return (
                  <View
                    key={s.place?.id ?? `stop-${s.orden}`}
                    style={[
                      styles.stop,
                      {
                        backgroundColor: palette.surface,
                        borderColor: isVisited ? palette.accent : palette.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.stopNum,
                        {
                          backgroundColor: isVisited
                            ? palette.primary
                            : isOmitted
                            ? palette.backgroundElement
                            : palette.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stopNumText,
                          {
                            color: isVisited
                              ? palette.surface
                              : isOmitted
                              ? palette.textSecondary
                              : palette.brand,
                          },
                        ]}
                      >
                        {isVisited ? '✓' : s.orden}
                      </Text>
                    </View>
                    <View style={styles.stopInfo}>
                      <View style={styles.stopHeaderRow}>
                        <Text style={[styles.stopHora, { color: palette.primary }]}>
                          {s.llegada} · {s.duracion_min} min
                        </Text>
                        <View
                          style={[
                            styles.stopBadgePill,
                            {
                              backgroundColor: isVisited
                                ? 'rgba(122, 158, 109, 0.16)'
                                : 'rgba(125, 41, 53, 0.08)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.stopBadgePillText,
                              { color: isVisited ? palette.brand : palette.burgundy },
                            ]}
                          >
                            {isVisited ? '✓ VISITADA' : 'NO VISITADA'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.stopNombre, { color: palette.brand }]}>{s.place?.nombre}</Text>
                      {!!s.place?.direccion && (
                        <Text style={[styles.stopDir, { color: palette.textSecondary }]} numberOfLines={1}>
                          {s.place.direccion}
                        </Text>
                      )}
                      <Text style={[styles.stopCosto, { color: palette.textSecondary }]}>
                        {s.costo_estimado === 0 ? 'Gratis' : `Entrada hasta S/ ${s.costo_estimado}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {categorias.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: palette.brand }]}>CATEGORÍAS SOLICITADAS</Text>
            <View style={[styles.whyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              {categorias.map((nombre) => (
                <Text
                  key={nombre}
                  style={[styles.why, { color: palette.textSecondary, marginBottom: 4 }]}
                >
                  {nombre}
                </Text>
              ))}
            </View>
          </>
        )}

        <View style={styles.stampWrap}>
          <AndeanTransitStamp
            compact={true}
            folio={
              estado === 'COMPLETADA'
                ? 'EXPEDICIÓN COMPLETA · SELLADA'
                : estado === 'PARCIAL'
                ? 'EXPEDICIÓN PARCIAL · ARCHIVADA'
                : estado === 'ABANDONADA'
                ? 'EXPEDICIÓN INTERRUMPIDA'
                : 'SOLICITUD REGISTRADA'
            }
            station="ARCHIVO PATRIMONIAL CHASKI"
            route={titulo.toUpperCase()}
          />
        </View>

        <View style={styles.ctaWrap}>
          <WizardButton
            label="VOLVER A MIS EXPLORACIONES"
            onPress={() => router.replace('/(tabs)/historial')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: { paddingTop: 14 },
  kicker: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginTop: 3,
  },
  summary: {
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 14,
    marginTop: 14,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  summaryVal: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  stopsList: {
    gap: 10,
  },
  stop: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  stopNum: {
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNumText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  stopInfo: { flex: 1, gap: 2 },
  stopHora: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
  },
  stopNombre: {
    fontFamily: Fonts.serif,
    fontSize: 14,
    fontWeight: '700',
  },
  stopDir: {
    fontFamily: Fonts.sans,
    fontSize: 11,
  },
  stopCosto: {
    fontFamily: Fonts.mono,
    fontSize: 10,
  },
  whyCard: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 14,
  },
  why: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
  },
  ctaWrap: { marginTop: 22 },
  emptyContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontFamily: Fonts.mono,
    fontSize: 14,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  historyMetaPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 8,
  },
  historyMetaPillText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stopHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  stopBadgePillText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stampWrap: {
    marginTop: 20,
    alignItems: 'center',
  },
});
