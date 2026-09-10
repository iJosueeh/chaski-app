/**
 * "Detalle del plan (Refinado)" — info completa del plan elegido:
 * itinerario hora por hora, costos, duración y por qué este plan.
 * "Elegir este plan" lo activa (Fase 4: PLAN ACTIVO + historial).
 */
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { TocapuStrip, WizardButton, WizardTopBar } from '@/features/wizard/components/wizard-ui';
import { usePlans } from '@/features/plans/context/plans-context';
import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';

export default function DetallePlan() {
  const theme = useTheme();
  const { activarPlan } = usePlans();
  const { plan: planJson } = useLocalSearchParams<{ plan?: string }>();
  let plan: GeneratedPlan | null = null;
  try {
    plan = JSON.parse(planJson ?? 'null');
  } catch {
    plan = null;
  }

  if (!plan) {
    return (
      <ThemedView style={styles.canvas}>
        <Text style={{ padding: 40 }}>Plan no encontrado.</Text>
      </ThemedView>
    );
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

      <View style={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.primary }]}>{plan.titulo.toUpperCase()}</Text>
          <Text style={[styles.title, { color: theme.brand }]}>{plan.descripcion}</Text>
        </View>

        {/* Resumen */}
        <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.brand }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>DURACIÓN</Text>
            <Text style={[styles.summaryVal, { color: theme.brand }]}>
              {Math.floor(plan.duracion_total_min / 60)}h {plan.duracion_total_min % 60}m
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>COSTO ESTIMADO</Text>
            <Text style={[styles.summaryVal, { color: theme.carmine }]}>S/ {plan.costo_total}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>DISTANCIA</Text>
            <Text style={[styles.summaryVal, { color: theme.brand }]}>≈ {plan.distancia_km_aprox} km</Text>
          </View>
        </View>

        {/* Itinerario */}
        <Text style={[styles.sectionTitle, { color: theme.brand }]}>ITINERARIO</Text>
        {plan.paradas.map((s) => (
          <View key={s.place.id} style={[styles.stop, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.stopNum, { backgroundColor: theme.accent }]}>
              <Text style={[styles.stopNumText, { color: theme.brand }]}>{s.orden}</Text>
            </View>
            <View style={styles.stopInfo}>
              <Text style={[styles.stopHora, { color: theme.primary }]}>
                {s.llegada} · {s.duracion_min} min
              </Text>
              <Text style={[styles.stopNombre, { color: theme.brand }]}>{s.place.nombre}</Text>
              {!!s.place.direccion && (
                <Text style={[styles.stopDir, { color: theme.textSecondary }]} numberOfLines={1}>
                  {s.place.direccion}
                </Text>
              )}
              <Text style={[styles.stopCosto, { color: theme.textSecondary }]}>
                {s.costo_estimado === 0 ? 'Gratis' : `Entrada hasta S/ ${s.costo_estimado}`}
              </Text>
            </View>
          </View>
        ))}

        {/* Por qué este plan */}
        <Text style={[styles.sectionTitle, { color: theme.brand }]}>¿POR QUÉ ESTE PLAN?</Text>
        <Text style={[styles.why, { color: theme.textSecondary }]}>
          Seleccionamos {plan.paradas.length} {plan.paradas.length === 1 ? 'lugar' : 'lugares'} según tus intereses, ordenados
          por cercanía para minimizar traslados, dentro de tu presupuesto de
          {' S/ ' + (plan.costo_total)} y tu tiempo disponible.
        </Text>

        <View style={styles.ctaWrap}>
          <WizardButton
            label="ELEGIR ESTE PLAN"
            onPress={async () => {
              await activarPlan(plan);
              router.dismissAll();
              router.replace('/(tabs)');
            }}
          />
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { paddingTop: 16 },
  kicker: {
    fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 10, letterSpacing: 2,
  },
  title: {
    fontFamily: 'Cinzel_700Bold', fontSize: 20, lineHeight: 28, marginTop: 4,
  },
  summary: {
    borderWidth: 1.5, borderRadius: 4, padding: 14, marginTop: 16, gap: 8,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 10, letterSpacing: 1,
  },
  summaryVal: {
    fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 12,
  },
  sectionTitle: {
    fontFamily: 'Cinzel_700Bold', fontSize: 15, marginTop: 24, marginBottom: 10,
  },
  stop: {
    flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 4,
    padding: 12, marginBottom: 8,
  },
  stopNum: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  stopNumText: {
    fontFamily: 'Cinzel_700Bold', fontSize: 13,
  },
  stopInfo: { flex: 1 },
  stopHora: {
    fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 9, letterSpacing: 1,
  },
  stopNombre: {
    fontFamily: 'Cinzel_700Bold', fontSize: 14, marginTop: 2,
  },
  stopDir: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 10, marginTop: 2,
  },
  stopCosto: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 10, marginTop: 4,
  },
  why: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, lineHeight: 17,
  },
  ctaWrap: { marginTop: 24 },
});
