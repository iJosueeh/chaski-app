/**
 * "Detalle del plan" — info completa del plan elegido (Serie AX):
 * itinerario parada por parada, costos, duración y justificación.
 * "Elegir este plan" lo activa y regresa de forma segura al inicio.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts } from '@/constants/theme';
import { AndeanTransitStamp } from '@/features/auth/components/andean-transit-stamp';
import { getPlaceImageUrl } from '@/features/places/services/places-storage.service';
import { RouteHeroBanner } from '@/features/plans/components/route-hero-banner';
import { getRouteCoverImage } from '@/features/plans/utils/route-image';
import { TocapuStrip, WizardButton, WizardTopBar } from '@/features/wizard/components/wizard-ui';
import { usePlans, type PlanHistorialEntry } from '@/features/plans/context/plans-context';
import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';
import type { SolicitudHistorialEntry } from '@/features/plans/interfaces/solicitudes-plan.interface';
import {
  formatFolioNumber,
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

function getStopPhotoUri(stop: GeneratedPlan['paradas'][number]): string | null {
  const place = stop.place;
  if (!place) return null;
  if (place.imagen_portada) {
    const trimmed = place.imagen_portada.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    const url = getPlaceImageUrl(trimmed);
    if (url) return url;
  }
  if (place.id) {
    const byId = getRouteCoverImage(null, place.id);
    if (byId) return byId;
  }
  if (place.nombre) {
    const byName = getRouteCoverImage(null, place.nombre);
    if (byName) return byName;
  }
  return null;
}

interface StopItemCardProps {
  stop: GeneratedPlan['paradas'][number];
  isVisited?: boolean;
  isOmitted?: boolean;
  isHistorial?: boolean;
  isLegacy?: boolean;
}

function StopItemCard({
  stop,
  isVisited,
  isOmitted,
  isHistorial,
  isLegacy,
}: StopItemCardProps) {
  const photoUri = getStopPhotoUri(stop);

  return (
    <View
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
          {isVisited ? '✓' : stop.orden}
        </Text>
      </View>

      <View style={styles.stopInfo}>
        <View style={styles.stopHeaderRow}>
          <Text style={[styles.stopHora, { color: palette.primary }]}>
            {stop.llegada} · {stop.duracion_min} min
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

        <Text style={[styles.stopNombre, { color: palette.brand }]} numberOfLines={2}>
          {stop.place?.nombre}
        </Text>

        {Boolean(stop.place?.direccion) && (
          <Text style={[styles.stopDir, { color: palette.textSecondary }]} numberOfLines={1}>
            {stop.place?.direccion}
          </Text>
        )}

        <Text style={[styles.stopCosto, { color: palette.textSecondary }]}>
          {stop.costo_estimado === 0 ? 'Acceso libre' : `Entrada estimada S/ ${stop.costo_estimado}`}
        </Text>
      </View>

      {Boolean(photoUri) && (
        <View style={[styles.stopPhotoWrap, { borderColor: palette.border }]}>
          <Image
            source={{ uri: photoUri! }}
            style={styles.stopPhoto}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`Fotografía de ${stop.place?.nombre}`}
          />
        </View>
      )}
    </View>
  );
}

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

  const heroBadge = isHistorial
    ? estado === 'COMPLETADA'
      ? '✓ EXPEDICIÓN SELLADA'
      : estado === 'PARCIAL'
      ? `EXPEDICIÓN PARCIAL (${paradasVisitadas.length}/${plan.paradas.length})`
      : estado === 'ABANDONADA'
      ? 'EXPEDICIÓN INTERRUMPIDA'
      : 'ARCHIVO HISTÓRICO'
    : 'PROPUESTA PATRIMONIAL';

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
        <RouteHeroBanner
          imageUrl={getRouteCoverImage(plan, plan.titulo)}
          title={plan.titulo}
          badge={heroBadge}
        />

        <View style={styles.header}>
          <View style={styles.headerKickerRow}>
            <View style={[styles.kickerBadge, { backgroundColor: palette.accent }]}>
              <Text style={[styles.kickerBadgeText, { color: palette.brand }]}>
                {isHistorial ? 'ARCHIVO HISTÓRICO' : 'PROPUESTA DE RUTA'}
              </Text>
            </View>
            <Text style={[styles.seriesText, { color: palette.burgundy }]}>SERIE AX</Text>
          </View>

          <Text style={[styles.title, { color: palette.brand }]}>{plan.titulo}</Text>

          {Boolean(plan.descripcion) && (
            <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{plan.descripcion}</Text>
          )}

          {isHistorial && Boolean(fechaCompletado) && (
            <View style={[styles.historyMetaPill, { backgroundColor: palette.backgroundElement, borderColor: palette.border }]}>
              <Text style={[styles.historyMetaPillText, { color: palette.burgundy }]}>
                {estado === 'ABANDONADA' ? 'Interrumpida el: ' : 'Sellado el: '}
                {fechaCompletado}
              </Text>
            </View>
          )}
        </View>

        {/* Bloque de Métricas Clave (Serie AX) */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricTile, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.metricTileLabel, { color: palette.textSecondary }]}>DURACIÓN</Text>
            <Text style={[styles.metricTileVal, { color: palette.brand }]}>
              {Math.floor(plan.duracion_total_min / 60)}h {plan.duracion_total_min % 60}m
            </Text>
          </View>
          <View style={[styles.metricTile, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.metricTileLabel, { color: palette.textSecondary }]}>ESTACIONES</Text>
            <Text style={[styles.metricTileVal, { color: palette.brand }]}>
              {plan.paradas.length} {plan.paradas.length === 1 ? 'parada' : 'paradas'}
            </Text>
          </View>
          <View style={[styles.metricTile, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.metricTileLabel, { color: palette.textSecondary }]}>COSTO ESTIMADO</Text>
            <Text style={[styles.metricTileVal, { color: palette.burgundy }]}>S/ {plan.costo_total}</Text>
          </View>
        </View>

        {Boolean(plan.distancia_km_aprox) && (
          <View style={[styles.distancePill, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Ionicons name="map-outline" size={13} color={palette.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.distancePillText, { color: palette.brand }]}>
              Recorrido aproximado: ≈ {plan.distancia_km_aprox} km
            </Text>
          </View>
        )}

        {/* Itinerario parada por parada */}
        <Text style={[styles.sectionTitle, { color: palette.brand }]}>
          {isHistorial ? 'ITINERARIO Y ESTADO DE ESTACIONES' : 'ITINERARIO DE ESTACIONES'}
        </Text>
        <View style={styles.stopsList}>
          {plan.paradas.map((s) => {
            const isVisited = isHistorial && !isLegacy && paradasVisitadas.includes(s.orden);
            const isOmitted = isHistorial && !isLegacy && !paradasVisitadas.includes(s.orden);

            return (
              <StopItemCard
                key={s.place?.id ?? `stop-${s.orden}`}
                stop={s}
                isVisited={isVisited}
                isOmitted={isOmitted}
                isHistorial={isHistorial}
                isLegacy={isLegacy}
              />
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

  const folio = formatFolioNumber(1, solicitud.id);

  const heroBadge = expedicion
    ? estado === 'COMPLETADA'
      ? '✓ EXPEDICIÓN SELLADA'
      : estado === 'PARCIAL'
      ? `EXPEDICIÓN PARCIAL (${visitadasList.length}/${paradasSnapshot.length})`
      : estado === 'ABANDONADA'
      ? 'EXPEDICIÓN INTERRUMPIDA'
      : 'ARCHIVO HISTÓRICO'
    : 'SOLICITUD SERIE AX';

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
        <RouteHeroBanner
          imageUrl={getRouteCoverImage(snapshot, solicitud.inicio_descripcion || titulo)}
          title={titulo}
          badge={heroBadge}
        />

        <View style={styles.header}>
          <View style={styles.headerKickerRow}>
            <View style={[styles.kickerBadge, { backgroundColor: palette.accent }]}>
              <Text style={[styles.kickerBadgeText, { color: palette.brand }]}>
                {expedicion ? 'EXPEDICIÓN ARCHIVADA' : 'SOLICITUD REGISTRADA'}
              </Text>
            </View>
            <Text style={[styles.seriesText, { color: palette.burgundy }]}>SERIE AX</Text>
          </View>

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

        {/* Bloque de Métricas Clave (Serie AX) */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricTile, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.metricTileLabel, { color: palette.textSecondary }]}>DURACIÓN</Text>
            <Text style={[styles.metricTileVal, { color: palette.brand }]}>{duracion}</Text>
          </View>
          <View style={[styles.metricTile, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.metricTileLabel, { color: palette.textSecondary }]}>
              {snapshot ? 'ESTACIONES' : 'PRESUPUESTO'}
            </Text>
            <Text style={[styles.metricTileVal, { color: palette.brand }]}>
              {snapshot ? `${paradasSnapshot.length} paradas` : presupuesto}
            </Text>
          </View>
          <View style={[styles.metricTile, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.metricTileLabel, { color: palette.textSecondary }]}>
              {snapshot ? 'GASTO REF.' : 'HORARIO'}
            </Text>
            <Text style={[styles.metricTileVal, { color: palette.burgundy }]}>
              {snapshot && snapshot.costo_total != null ? `S/ ${snapshot.costo_total}` : horario}
            </Text>
          </View>
        </View>

        {/* Ficha Logística / Hoja de Ruta */}
        <View style={[styles.logisticsCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.logisticsHeader}>
            <Text style={[styles.logisticsKicker, { color: palette.primary }]}>FICHA DE EXPEDICIÓN</Text>
            {Boolean(folio) && (
              <Text style={[styles.logisticsFolio, { color: palette.textSecondary }]}>
                {folio}
              </Text>
            )}
          </View>

          <View style={styles.logisticsRow}>
            <Ionicons name="time-outline" size={14} color={palette.accent} style={styles.logisticsIcon} />
            <Text style={[styles.logisticsLabel, { color: palette.textSecondary }]}>Horario:</Text>
            <Text style={[styles.logisticsValue, { color: palette.brand }]}>{horario}</Text>
          </View>

          <View style={styles.logisticsRow}>
            <Ionicons name="walk-outline" size={14} color={palette.accent} style={styles.logisticsIcon} />
            <Text style={[styles.logisticsLabel, { color: palette.textSecondary }]}>Movilidad:</Text>
            <Text style={[styles.logisticsValue, { color: palette.brand }]}>{movilidad}</Text>
          </View>

          <View style={styles.logisticsRow}>
            <Ionicons name="navigate-outline" size={14} color={palette.accent} style={styles.logisticsIcon} />
            <Text style={[styles.logisticsLabel, { color: palette.textSecondary }]}>Partida:</Text>
            <Text style={[styles.logisticsValue, { color: palette.brand }]} numberOfLines={2}>
              {partida}
            </Text>
          </View>

          <View style={styles.logisticsRow}>
            <Ionicons name="location-outline" size={14} color={palette.accent} style={styles.logisticsIcon} />
            <Text style={[styles.logisticsLabel, { color: palette.textSecondary }]}>Punto final:</Text>
            <Text style={[styles.logisticsValue, { color: palette.brand }]} numberOfLines={2}>
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
                  <StopItemCard
                    key={s.place?.id ?? `stop-${s.orden}`}
                    stop={s}
                    isVisited={isVisited}
                    isOmitted={isOmitted}
                    isHistorial={Boolean(expedicion)}
                    isLegacy={false}
                  />
                );
              })}
            </View>
          </>
        )}

        {categorias.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: palette.brand }]}>AFINIDADES Y CATEGORÍAS</Text>
            <View style={styles.categoryChipsWrap}>
              {categorias.map((cat) => (
                <View
                  key={cat}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Ionicons name="sparkles-outline" size={11} color={palette.accent} style={{ marginRight: 5 }} />
                  <Text style={[styles.categoryChipText, { color: palette.brand }]}>
                    {cat.toUpperCase()}
                  </Text>
                </View>
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
  headerKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  kickerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  kickerBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  seriesText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginTop: 3,
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
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  metricTile: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTileLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 3,
    textAlign: 'center',
  },
  metricTileVal: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
  },
  distancePillText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '600',
  },
  logisticsCard: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 14,
    marginTop: 12,
    gap: 8,
  },
  logisticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logisticsKicker: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  logisticsFolio: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  logisticsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  logisticsIcon: {
    marginTop: 1,
  },
  logisticsLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '600',
    minWidth: 70,
  },
  logisticsValue: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
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
  stopHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopHora: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
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
  stopPhotoWrap: {
    width: 56,
    height: 56,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stopPhoto: {
    width: '100%',
    height: '100%',
  },
  categoryChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  categoryChipText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.6,
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
  stampWrap: {
    marginTop: 20,
    alignItems: 'center',
  },
});
