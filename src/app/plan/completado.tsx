/**
 * Plan Completado — pantalla de celebración (frame "Plan completado").
 * Se muestra al FINALIZAR PLAN: resumen del plan archivado en historial.
 */
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { TocapuStrip, WizardButton } from '@/features/wizard/components/wizard-ui';
import { usePlans } from '@/features/plans/context/plans-context';

export default function PlanCompletadoScreen() {
  const theme = useTheme();
  const { historial } = usePlans();
  const entry = historial[0]; // recién archivado

  const fecha = entry
    ? new Date(entry.completado_en).toLocaleDateString('es-PE', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '';

  return (
    <ThemedView style={styles.canvas}>
      <TocapuStrip />

      <View style={styles.body}>
        <Text style={styles.glyph}>🎉</Text>
        <Text style={[styles.kicker, { color: theme.primary }]}>
          BOLETO VALIDADO · SERIE AX
        </Text>
        <Text style={[styles.title, { color: theme.brand }]}>¡PLAN COMPLETADO!</Text>

        {entry ? (
          <>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              {fecha} · {entry.paradas.length} paradas ·{' '}
              {Math.round((entry.duracion_total_min / 60) * 10) / 10}h
            </Text>

            {/* Resumen de paradas logradas */}
            <View style={[styles.ticket, { backgroundColor: theme.surface, borderColor: theme.brand }]}>
              <View style={[styles.ticketAccent, { backgroundColor: theme.accent }]} />
              <Text style={[styles.ticketKicker, { color: theme.primary }]}>PARADAS LOGRADAS</Text>
              {entry.paradas.map((s) => (
                <View key={s.orden} style={styles.paradaRow}>
                  <View style={[styles.paradaDot, { backgroundColor: theme.brand }]} />
                  <Text style={[styles.paradaNombre, { color: theme.brand }]}>
                    {s.place.nombre}
                  </Text>
                  <Text style={[styles.paradaHora, { color: theme.textSecondary }]}>
                    {s.llegada}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.ctas}>
          <WizardButton
            label="VER MIS EXPLORACIONES"
            onPress={() => router.replace('/(tabs)/historial')}
          />
          <WizardButton
            label="VOLVER AL INICIO"
            onPress={() => {
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
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  glyph: { fontSize: 44, textAlign: 'center' },
  kicker: {
    fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 10, letterSpacing: 2, textAlign: 'center', marginTop: 8,
  },
  title: {
    fontFamily: 'Cinzel_700Bold', fontSize: 24, textAlign: 'center', marginTop: 6,
  },
  sub: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, textAlign: 'center', marginTop: 6,
  },
  ticket: {
    borderRadius: 4, borderWidth: 1.5, overflow: 'hidden', padding: 16, marginTop: 20,
  },
  ticketAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 },
  ticketKicker: {
    fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 9, letterSpacing: 2,
  },
  paradaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10,
  },
  paradaDot: { width: 8, height: 8, borderRadius: 4 },
  paradaNombre: {
    fontFamily: 'Cinzel_700Bold', fontSize: 12, flex: 1,
  },
  paradaHora: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 10,
  },
  ctas: { gap: 10, marginTop: 'auto', paddingBottom: 32 },
});
