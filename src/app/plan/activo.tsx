/**
 * Plan Activo — el recorrido en curso (frame "Plan activo (Refinado)").
 * Lista de paradas ordenadas: se marca cada una como visitada (multiselect,
 * regla acordada) y al completar todas se ofrece FINALIZAR PLAN.
 * Al finalizar: Plan completado -> historial.
 */
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { TocapuStrip, WizardButton, WizardTopBar } from '@/features/wizard/components/wizard-ui';
import { usePlans } from '@/features/plans/context/plans-context';

export default function PlanActivoScreen() {
  const theme = useTheme();
  const {
    planActivo,
    visitadas,
    marcarParada,
    paradaVisitada,
    completarPlan,
    cancelarPlan,
  } = usePlans();

  if (!planActivo) {
    return (
      <ThemedView style={styles.canvas}>
        <WizardTopBar onBack={() => router.back()} onCancel={() => router.back()} />
        <TocapuStrip />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyGlyph}>🎫</Text>
          <Text style={[styles.emptyTitle, { color: theme.brand }]}>No hay plan activo</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Crea un plan desde el inicio
          </Text>
        </View>
      </ThemedView>
    );
  }

  const total = planActivo.paradas.length;
  const pct = Math.round((visitadas.length / total) * 100);

  const finalizar = async () => {
    await completarPlan();
    router.replace('/plan/completado');
  };

  const abandonar = async () => {
    await cancelarPlan();
    router.dismissAll();
    router.replace('/(tabs)');
  };

  return (
    <ThemedView style={styles.canvas}>
      <WizardTopBar
        onBack={() => router.back()}
        onCancel={abandonar}
      />
      <TocapuStrip />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.primary }]}>EN CURSO · SERIE AX</Text>
          <Text style={[styles.title, { color: theme.brand }]}>{planActivo.titulo}</Text>

          {/* Progreso */}
          <View style={styles.progressRow}>
            <Text style={[styles.progressLabel, { color: theme.brand }]}>
              Parada {Math.min(visitadas.length + 1, total)} de {total}
            </Text>
            <Text style={[styles.progressPct, { color: theme.carmine }]}>{pct}%</Text>
          </View>
          <View style={[styles.progressTrack, { borderColor: theme.brand, backgroundColor: theme.background }]}>
            <View style={[styles.progressFill, { backgroundColor: theme.carmine, width: `${pct}%` }]} />
          </View>
        </View>

        {/* Paradas multiselect (regla: tocar = toggle; el estilo prioriza, no elimina) */}
        <View style={styles.stops}>
          {planActivo.paradas.map((s) => {
            const done = paradaVisitada(s.orden);
            return (
              <TouchableOpacity
                key={s.orden}
                activeOpacity={0.8}
                onPress={() => marcarParada(s.orden)}>
                <View
                  style={[
                    styles.stop,
                    {
                      backgroundColor: theme.surface,
                      borderColor: done ? theme.success : theme.brand,
                      borderWidth: done ? 2 : 1.5,
                    },
                  ]}>
                  <View
                    style={[
                      styles.check,
                      { borderColor: done ? theme.brand : 'rgba(74,46,24,0.4)' },
                    ]}>
                    {done ? (
                      <Text style={[styles.checkMark, { color: theme.brand }]}>✓</Text>
                    ) : null}
                  </View>
                  <View style={styles.stopInfo}>
                    <Text style={[styles.stopHora, { color: theme.primary }]}>
                      {s.llegada} · {s.duracion_min} min
                    </Text>
                    <Text
                      style={[
                        styles.stopNombre,
                        { color: theme.brand },
                        done && styles.stopNombreDone,
                      ]}>
                      {s.place.nombre}
                    </Text>
                    <Text style={[styles.stopCosto, { color: theme.textSecondary }]}>
                      {s.costo_estimado === 0 ? 'Gratis' : `Entrada hasta S/ ${s.costo_estimado}`}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.ctaWrap}>
          <WizardButton
            label={visitadas.length >= total ? 'FINALIZAR PLAN' : `FINALIZAR (${visitadas.length}/${total})`}
            onPress={finalizar}
            disabled={visitadas.length === 0}
          />
          <Text style={[styles.cancelHint, { color: theme.textSecondary }]}>
            ¿Ya no continuarás? Toca ✕ arriba para abandonar (el plan no se archiva).
          </Text>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scroll: { paddingBottom: 40 },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  kicker: {
    fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 10, letterSpacing: 2,
  },
  title: {
    fontFamily: 'Cinzel_700Bold', fontSize: 22, lineHeight: 30, marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 6,
  },
  progressLabel: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 11,
  },
  progressPct: {
    fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 12,
  },
  progressTrack: {
    height: 10, borderRadius: 3, borderWidth: 1, overflow: 'hidden',
  },
  progressFill: { height: '100%' },

  stops: { paddingHorizontal: 20, gap: 10, marginTop: 20 },
  stop: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 4, padding: 14,
  },
  check: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { fontSize: 15, fontWeight: '700' },
  stopInfo: { flex: 1 },
  stopHora: {
    fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 9, letterSpacing: 1,
  },
  stopNombre: {
    fontFamily: 'Cinzel_700Bold', fontSize: 14, marginTop: 2,
  },
  stopNombreDone: { textDecorationLine: 'line-through', opacity: 0.6 },
  stopCosto: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 10, marginTop: 2,
  },

  ctaWrap: { paddingHorizontal: 20, marginTop: 24 },
  cancelHint: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 9, textAlign: 'center', marginTop: 10,
  },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyGlyph: { fontSize: 32 },
  emptyTitle: {
    fontFamily: 'Cinzel_700Bold', fontSize: 16,
  },
  emptyText: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 11,
  },
});
