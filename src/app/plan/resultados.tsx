/**
 * "Resultados de búsqueda" — Planes generados por el motor como boletos (Serie AX).
 * El usuario toca uno → Detalle del plan.
 */
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { TocapuStrip, WizardButton, WizardTopBar } from '@/features/wizard/components/wizard-ui';
import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';
import { safeBackWizard, safeCancelWizard } from '@/features/wizard/utils/wizard-navigation';

const palette = Colors.light;

function formatDuracion(minutosTotales: number): string {
  const h = Math.floor(minutosTotales / 60);
  const m = minutosTotales % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function getRutaDetalles(p: GeneratedPlan) {
  const duracionTxt = formatDuracion(p.duracion_total_min);
  const paradasCount = p.paradas.length;
  const paradasTxt = `${paradasCount} ${paradasCount === 1 ? 'parada' : 'paradas'}`;
  const origenNombre = p.paradas[0]?.place?.nombre ?? 'tu origen';
  const costoTxt = p.costo_total === 0 ? 'Acceso libre' : `S/ ${p.costo_total}`;

  switch (p.variante) {
    case 'intimo':
      return {
        badge: 'RITMO PAUSADO',
        subtitulo: 'Recorrido concentrado',
        explicacion: `Diseñada para visitar ${paradasTxt} con traslados cortos (≈${p.distancia_km_aprox} km), iniciando en ${origenNombre} para un paseo pausado de ${duracionTxt}.`,
      };
    case 'equilibrado':
      return {
        badge: 'EQUILIBRADO',
        subtitulo: 'Balance de tiempo y patrimonio',
        explicacion: `Combina ${paradasTxt} con una duración de ${duracionTxt} y presupuesto de ${costoTxt}, optimizando la secuencia entre sitios emblemáticos.`,
      };
    case 'explorador':
      return {
        badge: 'EXPLORADOR',
        subtitulo: 'Máxima inmersión cultural',
        explicacion: `Aprovecha toda tu jornada con ${paradasTxt} desde ${origenNombre}, maximizando la variedad de categorías culturales visitadas.`,
      };
    default:
      return {
        badge: 'EXPEDICIÓN',
        subtitulo: `${paradasTxt} seleccionadas`,
        explicacion: `Recorrido de ${duracionTxt} por ${paradasTxt} con un costo estimado de ${costoTxt}.`,
      };
  }
}

export default function ResultadosPlanes() {
  const insets = useSafeAreaInsets();
  const { planes: planesJson, solicitudId } = useLocalSearchParams<{ planes?: string; solicitudId?: string }>();

  const planes = useMemo<GeneratedPlan[]>(() => {
    try {
      const parsed: GeneratedPlan[] = JSON.parse(planesJson ?? '[]');
      if (solicitudId) {
        return parsed.map((p) => ({ ...p, solicitud_id: p.solicitud_id || solicitudId }));
      }
      return parsed;
    } catch {
      return [];
    }
  }, [planesJson, solicitudId]);

  // Criterio objetivo y verificable para «Mejor coincidencia»:
  // Solo se asigna si existe al menos un plan con score numérico positivo comprobable.
  const mejorCoincidenciaId = useMemo(() => {
    let bestId: string | null = null;
    let maxScore = 0;
    for (const p of planes) {
      if (typeof p.score === 'number' && p.score > maxScore) {
        maxScore = p.score;
        bestId = p.id;
      }
    }
    return bestId;
  }, [planes]);

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <WizardTopBar
        onBack={() => safeBackWizard('/wizard/movilidad')}
        onCancel={safeCancelWizard}
      />
      <TocapuStrip />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 16) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.primary }]}>RESULTADOS DE EXPEDICIÓN</Text>
          <Text style={[styles.title, { color: palette.brand }]}>
            Encontramos {planes.length} {planes.length === 1 ? 'ruta disponible' : 'rutas disponibles'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]}>
            Cada opción ofrece un ritmo distinto ajustado a tu ubicación y preferencias.
          </Text>
        </View>

        {planes.length === 0 ? (
          /* Estado sin resultados: explicación honesta + acciones útiles */
          <View style={[styles.emptyWrap, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={styles.emptyGlyph}>📜</Text>
            <Text style={[styles.emptyTitle, { color: palette.brand }]}>
              Sin rutas con estos criterios
            </Text>
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              Ningún destino cultural activo coincide simultáneamente con tu ubicación, tiempo disponible y presupuesto. Te sugerimos ampliar el tiempo o tus intereses.
            </Text>
            <View style={styles.emptyCtaWrap}>
              <WizardButton
                label="AJUSTAR TIEMPO Y PRESUPUESTO"
                onPress={() => safeBackWizard('/wizard/tiempo')}
              />
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Ampliar intereses culturales"
              activeOpacity={0.7}
              onPress={() => safeBackWizard('/wizard/intereses')}
              style={styles.emptySecondaryBtn}
            >
              <Text style={[styles.emptySecondaryText, { color: palette.primary }]}>
                MODIFICAR INTERESES CULTURALES
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cards}>
            {planes.map((p) => {
              const esMejor = p.id === mejorCoincidenciaId;
              const detalles = getRutaDetalles(p);
              const duracion = formatDuracion(p.duracion_total_min);

              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: '/plan/detalle',
                      params: { plan: JSON.stringify(p) },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${p.titulo}: ${detalles.subtitulo}. Duración ${duracion}, costo S/ ${p.costo_total}.`}
                >
                  <View
                    style={[
                      styles.card,
                      {
                        backgroundColor: palette.surface,
                        borderColor: esMejor ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.cardAccent,
                        { backgroundColor: esMejor ? palette.primary : palette.accent },
                      ]}
                    />

                    {/* Cabecera de la tarjeta con badges de distinción */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.badgeRow}>
                        <View style={[styles.variantBadge, { backgroundColor: palette.backgroundElement, borderColor: palette.border }]}>
                          <Text style={[styles.variantBadgeText, { color: palette.brand }]}>
                            {detalles.badge}
                          </Text>
                        </View>
                        {esMejor && (
                          <View style={[styles.bestMatchBadge, { backgroundColor: palette.accent }]}>
                            <Text style={[styles.bestMatchText, { color: palette.brand }]}>
                              ★ MEJOR COINCIDENCIA
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.cardFolio, { color: palette.textSecondary }]}>
                        {p.paradas.length} {p.paradas.length === 1 ? 'PARADA' : 'PARADAS'}
                      </Text>
                    </View>

                    <Text style={[styles.cardTitle, { color: palette.brand }]}>
                      {p.titulo}
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: palette.primary }]}>
                      {detalles.subtitulo}
                    </Text>

                    {/* Explicación objetiva de la ruta */}
                    <View style={[styles.reasonBox, { backgroundColor: palette.backgroundElement, borderColor: palette.border }]}>
                      <Text style={[styles.reasonLabel, { color: palette.primary }]}>
                        ¿POR QUÉ ESTA RUTA?
                      </Text>
                      <Text style={[styles.reasonText, { color: palette.textSecondary }]}>
                        {detalles.explicacion}
                      </Text>
                    </View>

                    {/* Fila de métricas objetivas */}
                    <View style={[styles.cardMeta, { borderTopColor: palette.border }]}>
                      <View style={styles.metaCol}>
                        <Text style={[styles.metaColLabel, { color: palette.textSecondary }]}>TIEMPO</Text>
                        <Text style={[styles.metaColValue, { color: palette.brand }]}>{duracion}</Text>
                      </View>
                      <View style={[styles.metaColDivider, { backgroundColor: palette.border }]} />
                      <View style={styles.metaCol}>
                        <Text style={[styles.metaColLabel, { color: palette.textSecondary }]}>DISTANCIA</Text>
                        <Text style={[styles.metaColValue, { color: palette.brand }]}>≈ {p.distancia_km_aprox} km</Text>
                      </View>
                      <View style={[styles.metaColDivider, { backgroundColor: palette.border }]} />
                      <View style={styles.metaCol}>
                        <Text style={[styles.metaColLabel, { color: palette.textSecondary }]}>COSTO</Text>
                        <Text style={[styles.metaColValue, { color: palette.burgundy }]}>
                          {p.costo_total === 0 ? 'Gratis' : `S/ ${p.costo_total}`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardCtaRow}>
                      <Text style={[styles.cardCta, { color: palette.primary }]}>
                        ELEGIR Y VER ITINERARIO →
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scroll: { paddingBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 14 },
  kicker: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 21,
    fontWeight: '700',
    marginTop: 3,
  },
  headerSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },

  cards: { paddingHorizontal: 20, gap: 14, marginTop: 16 },
  card: {
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 16,
    overflow: 'hidden',
  },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3.5 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  variantBadge: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  variantBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  bestMatchBadge: {
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  bestMatchText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cardFolio: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardTitle: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  cardSubtitle: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
    marginBottom: 8,
  },

  reasonBox: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    gap: 3,
  },
  reasonLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  reasonText: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    lineHeight: 16,
  },

  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  metaCol: {
    flex: 1,
    alignItems: 'center',
  },
  metaColLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  metaColValue: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
  },
  metaColDivider: {
    width: 1,
    height: 20,
  },

  cardCtaRow: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  cardCta: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
  },

  emptyWrap: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 22,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  emptyGlyph: { fontSize: 38, textAlign: 'center' },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCtaWrap: {
    width: '100%',
    marginTop: 12,
  },
  emptySecondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  emptySecondaryText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
});
