/**
 * "Resultados de búsqueda" — 3 planes generados por el motor como boletos.
 * El usuario toca uno → Detalle del plan.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { TocapuStrip, WizardButton, WizardTopBar } from '@/features/wizard/components/wizard-ui';
import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';

export default function ResultadosPlanes() {
  const theme = useTheme();
  const { planes: planesJson } = useLocalSearchParams<{ planes?: string }>();
  let planes: GeneratedPlan[] = [];
  try {
    planes = JSON.parse(planesJson ?? '[]');
  } catch {
    planes = [];
  }

  return (
    <ThemedView style={styles.canvas}>
      <WizardTopBar
        onBack={() => router.back()}
        onCancel={() => {
          router.dismissAll();
          router.back();
        }}
      />
      <TocapuStrip />
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: theme.primary }]}>RESULTADOS DE BÚSQUEDA</Text>
        <Text style={[styles.title, { color: theme.brand }]}>
          Encontramos {planes.length} {planes.length === 1 ? 'plan' : 'planes'} para ti
        </Text>
      </View>

      {planes.length === 0 ? (
        /* Frame «Sin resultados»: mensaje honesto + CTA de salida */
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyGlyph}>🚫</Text>
          <Text style={[styles.emptyTitle, { color: theme.brand }]}>
            Sin planes con esos filtros
          </Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Ninguna parada cabe en tu tiempo, presupuesto e intereses. Prueba con más horas o sin filtro de intereses.
          </Text>
          <View style={styles.emptyCtaWrap}>
            <WizardButton label="AJUSTAR BÚSQUEDA" onPress={() => router.push('/wizard/intereses')} />
          </View>
        </View>
      ) : (
      <View style={styles.cards}>
        {planes.map((p) => (
          <TouchableOpacity
            key={p.id}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/plan/detalle', params: { plan: JSON.stringify(p) } })}>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.brand }]}>
              <View style={[styles.cardAccent, { backgroundColor: theme.accent }]} />
              <Text style={[styles.cardKicker, { color: theme.primary }]}>{p.titulo.toUpperCase()}</Text>
              <Text style={[styles.cardTitle, { color: theme.brand }]}>{p.descripcion}</Text>
              <View style={styles.cardMeta}>
                <Text style={[styles.metaText, { color: theme.brand }]}>
                  ⏱ {Math.round(p.duracion_total_min / 60 * 10) / 10}h · 🚩 {p.paradas.length} {p.paradas.length === 1 ? 'parada' : 'paradas'}
                </Text>
                <Text style={[styles.metaText, { color: theme.carmine }]}>
                  S/ {p.costo_total}
                </Text>
              </View>
              <Text style={[styles.cardCta, { color: theme.primary }]}>VER DETALLE →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  kicker: {
    fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 10, letterSpacing: 2,
  },
  title: {
    fontFamily: 'Cinzel_700Bold', fontSize: 22, marginTop: 4,
  },
  cards: { paddingHorizontal: 20, gap: 16, marginTop: 20 },
  card: {
    borderWidth: 1.5, borderRadius: 4, padding: 16, overflow: 'hidden',
  },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  cardKicker: {
    fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 9, letterSpacing: 1.5,
  },
  cardTitle: {
    fontFamily: 'Cinzel_700Bold', fontSize: 17, marginTop: 4, lineHeight: 24,
  },
  cardMeta: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 10,
  },
  metaText: {
    fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 11,
  },
  cardCta: {
    fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 10, letterSpacing: 1,
    marginTop: 12, textAlign: 'right',
  },

  /* Frame «Sin resultados» */
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyGlyph: { fontSize: 40 },
  emptyTitle: {
    fontFamily: 'Cinzel_700Bold', fontSize: 18, textAlign: 'center',
  },
  emptyText: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, textAlign: 'center',
  },
  emptyCtaWrap: { alignSelf: 'stretch', marginTop: 16 },
});
